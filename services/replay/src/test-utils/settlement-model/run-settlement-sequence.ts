import { isDeepStrictEqual } from 'node:util';
import { safe } from '@orpc/client';
import { makeContentDocumentLoader } from '@vers/content-registry';
import type { ActivityContract } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import { buildStateFromSeed } from '@vers/game-utils';
import { buildLevelFromXP } from '@vers/idle-core';
import { resolveServiceURL } from '@vers/mock-services';
import { createServiceToken, createTestUser } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import pino from 'pino';
import invariant from 'tiny-invariant';
import { match } from 'ts-pattern';
import { createReplayCache } from '../../replay/create-replay-cache';
import { runReplayIteration } from '../../worker/run-replay-iteration';
import type { ReplayWorkerDeps } from '../../worker/types';
import { createAvatarRow } from '../create-avatar-row';
import { createHonestActivityFixture } from '../create-honest-activity-fixture';
import { buildClientBuildXP } from './build-client-build-xp';
import { buildModelActivity } from './build-model-activity';
import { buildModelAfterCall } from './build-model-after-call';
import { buildModelAfterIteration } from './build-model-after-iteration';
import { buildModelAfterStart } from './build-model-after-start';
import { collectSettlementViolations } from './collect-settlement-violations';
import { readSettlementSnapshot } from './read-settlement-snapshot';
import { toSettlementSnapshot } from './to-settlement-snapshot';
import type {
  CallOutcome,
  ModelCall,
  SettlementCase,
  SettlementCommand,
  SettlementDevice,
  SettlementFailure,
  SettlementModel,
  SettlementSnapshot,
} from './types';

const AVATAR_ID = 'avatar_settlement_model';

type ActivityClient = ReturnType<typeof buildRPCTestClient<ActivityContract>>;

interface SettlementWiring {
  readonly app: Parameters<typeof buildRPCTestClient>[0];
  readonly db: Kysely<DB>;
  readonly privateKey: CryptoKey;
}

interface SequenceRuntime {
  readonly clients: Readonly<Record<SettlementDevice, ActivityClient>>;
  readonly db: Kysely<DB>;
  readonly replayDeps: ReplayWorkerDeps;
}

interface SequenceState {
  readonly model: SettlementModel;
  readonly snapshot: SettlementSnapshot;
}

export async function runSettlementSequence(
  wiring: Readonly<SettlementWiring>,
  settlementCase: Readonly<SettlementCase>,
): Promise<SettlementFailure | undefined> {
  const db = wiring.db;

  const created = await createTestUser(db, { password: null });

  const cache = createReplayCache();

  try {
    await createAvatarRow(db, {
      id: AVATAR_ID,
      seed: settlementCase.avatarSeed,
      userId: created.user.id,
    });

    // the second scope opens from its own first clear, so no earlier activity has to clear it
    await db
      .insertInto('avatarGrants')
      .values({ avatarId: AVATAR_ID, key: '1_0', kind: 'first_clear' })
      .execute();

    const createDeviceClient = async (device: SettlementDevice): Promise<ActivityClient> =>
      buildRPCTestClient<ActivityContract>(wiring.app, {
        token: await createServiceToken({
          actingSessionID: device,
          actingUserID: created.user.id,
          audience: 'service-activity',
          expiresIn: '10m',
          privateKey: wiring.privateKey,
        }),
      });

    const runtime: SequenceRuntime = {
      clients: {
        'device-a': await createDeviceClient('device-a'),
        'device-b': await createDeviceClient('device-b'),
      },
      db,
      replayDeps: {
        cache,
        db,
        keysServiceURL: resolveServiceURL('keys'),
        loadContentDocument: makeContentDocumentLoader(db),
        logger: pino({ enabled: false }),
        privateKey: wiring.privateKey,
        simVersion: 'test-engine-hash',
      },
    };

    let state: SequenceState = {
      model: { activities: [], avatarXP: 0, chains: [], grants: ['1_0'], items: [] },
      snapshot: await readSettlementSnapshot(db, AVATAR_ID),
    };

    const commands: ReadonlyArray<SettlementCommand> = [
      ...settlementCase.commands,
      { kind: 'settle-all' },
    ];

    for (const [step, command] of commands.entries()) {
      const result = await runCommand(runtime, state, { command, step });

      if (result.kind === 'failed') {
        return result.failure;
      }

      state = result.state;
    }

    return undefined;
  } finally {
    cache.stopAll();

    await db.deleteFrom('users').where('id', '=', created.user.id).execute();
  }
}

// a settle-all ends once the verifier goes idle; this bound only stops a loop the model cannot end
const MAX_ITERATIONS_PER_SETTLE = 24;

type StepResult =
  | { readonly failure: SettlementFailure; readonly kind: 'failed' }
  | { readonly kind: 'passed'; readonly state: SequenceState };

interface StepLabel {
  readonly command: SettlementCommand;
  readonly step: number;
}

function runCommand(
  runtime: Readonly<SequenceRuntime>,
  state: Readonly<SequenceState>,
  label: Readonly<StepLabel>,
): Promise<StepResult> {
  const current = state.model.activities.at(-1);
  const skipped = Promise.resolve({ kind: 'passed', state } as const);

  return match(label.command)
    .with({ kind: 'start' }, async (start) => {
      if (current?.status === 'active') {
        return skipped;
      }

      const model = await runStart(runtime, state.model, start);

      return checkStep(runtime, label, { model, previous: state.snapshot });
    })
    .with({ kind: 'deliver' }, { kind: 'forge' }, (deliver) => {
      if (current === undefined || current.appendedHead >= current.checkpoints.length) {
        return skipped;
      }

      const lastVersion = Math.min(
        current.checkpoints.length,
        current.appendedHead + deliver.count,
      );

      return runCall(runtime, state, label, {
        device: deliver.device,
        expectedHead: current.appendedHead,
        forged: deliver.kind === 'forge',
        kind: 'deliver',
        lastVersion,
      });
    })
    .with({ kind: 'redeliver' }, (redeliver) => {
      const lastVersion = (current?.appendedHead ?? 0) - redeliver.skip;

      if (lastVersion < 1) {
        return skipped;
      }

      return runCall(runtime, state, label, {
        device: redeliver.device,
        expectedHead: Math.max(0, lastVersion - redeliver.count),
        forged: false,
        kind: 'deliver',
        lastVersion,
      });
    })
    .with({ kind: 'stop' }, { kind: 'takeover' }, (call) =>
      current === undefined ? skipped : runCall(runtime, state, label, call),
    )
    .with({ kind: 'settle-one' }, () => runIteration(runtime, state, label))
    .with({ kind: 'settle-all' }, async () => {
      let settled: Readonly<SequenceState> = state;

      for (let iteration = 0; iteration < MAX_ITERATIONS_PER_SETTLE; iteration += 1) {
        const result = await runIteration(runtime, settled, label);

        if (result.kind === 'failed') {
          return result;
        }

        if (result.state.model === settled.model) {
          return result;
        }

        settled = result.state;
      }

      return {
        failure: { ...label, violations: ['the verifier never went idle'] },
        kind: 'failed',
      } as const;
    })
    .exhaustive();
}

async function runStart(
  runtime: Readonly<SequenceRuntime>,
  model: Readonly<SettlementModel>,
  start: Readonly<Extract<SettlementCommand, { kind: 'start' }>>,
): Promise<SettlementModel> {
  const buildXP = buildClientBuildXP(model);
  const predecessorID = model.activities.at(-1)?.id ?? null;

  // the device starts from the anchor the server reports, as a node reveal hands it over
  const chainRow = await runtime.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', AVATAR_ID)
    .where('scopeId', '=', start.scopeID)
    .executeTakeFirst();

  const fixture = await createHonestActivityFixture(runtime.db, {
    activity: { predecessorActivityId: predecessorID },
    appendedHead: 0,
    avatarID: AVATAR_ID,
    buildSnapshot: { level: buildLevelFromXP(buildXP), xp: buildXP },
    completedNodeIDs: [],
    duration: start.durationMs,
    ...(chainRow === undefined
      ? { chain: { scopeId: start.scopeID }, seed: buildStateFromSeed(start.genesis) }
      : { chainRow, seed: chainRow.appendedNextSeed }),
  });

  return buildModelAfterStart(
    model,
    buildModelActivity({
      buildXP,
      checkpoints: fixture.checkpoints,
      engineCheckpoints: fixture.engineCheckpoints,
      id: fixture.activity.id,
      predecessorID,
      scopeID: start.scopeID,
      startChainIndex: fixture.activity.startChainIndex,
    }),
  );
}

interface CheckStepInput {
  readonly model: SettlementModel;
  readonly previous: SettlementSnapshot;
}

async function checkStep(
  runtime: Readonly<SequenceRuntime>,
  label: Readonly<StepLabel>,
  input: Readonly<CheckStepInput>,
): Promise<StepResult> {
  const snapshot = await readSettlementSnapshot(runtime.db, AVATAR_ID);

  const expected = toSettlementSnapshot(input.model);

  const violations = [
    ...collectSettlementViolations({
      activities: input.model.activities,
      current: snapshot,
      previous: input.previous,
    }),
    ...(isDeepStrictEqual(snapshot, expected) ? [] : ['model: the stored state left the model']),
  ];

  if (violations.length > 0) {
    return {
      failure: { ...label, actual: snapshot, expected, violations },
      kind: 'failed',
    };
  }

  return { kind: 'passed', state: { model: input.model, snapshot } };
}

async function runCall(
  runtime: Readonly<SequenceRuntime>,
  state: Readonly<SequenceState>,
  label: Readonly<StepLabel>,
  call: Readonly<ModelCall>,
): Promise<StepResult> {
  const current = state.model.activities.at(-1);

  invariant(current, 'a call is only run once an activity exists');

  const client = runtime.clients[call.device];

  const request = match(call)
    .with({ kind: 'deliver' }, (delivery) =>
      client.trackActivityProgress({
        activityID: current.id,
        checkpoints: current.checkpoints
          .slice(delivery.expectedHead, delivery.lastVersion)
          .map((checkpoint) => {
            const version = checkpoint.entry.version;

            const isForged =
              version === current.tamperedVersion ||
              (delivery.forged && version === delivery.lastVersion);

            return isForged ? checkpoint.forgedEntry : checkpoint.entry;
          }),
        expectedHead: delivery.expectedHead,
      }),
    )
    .with({ kind: 'stop' }, () =>
      client.stopActivity({ activityID: current.id, avatarID: AVATAR_ID }),
    )
    .with({ kind: 'takeover' }, () => client.resumeActivity({ activityID: current.id }))
    .exhaustive();

  const response = await safe(request);

  const refusedCode = !response.isSuccess && response.isDefined ? response.error.code : undefined;

  if (!response.isSuccess && (refusedCode === undefined || !isRefusalCode(refusedCode))) {
    throw response.error;
  }

  const actual: CallOutcome =
    refusedCode !== undefined && isRefusalCode(refusedCode)
      ? { code: refusedCode, kind: 'refused' }
      : { kind: 'accepted' };

  const expected = buildModelAfterCall(state.model, call);

  if (!isDeepStrictEqual(actual, expected.outcome)) {
    return {
      failure: { ...label, actual, expected: expected.outcome, violations: ['call outcome'] },
      kind: 'failed',
    };
  }

  return checkStep(runtime, label, { model: expected.model, previous: state.snapshot });
}

const REFUSAL_CODES: ReadonlySet<string> = new Set([
  'ACTIVITY_TERMINAL',
  'CONFLICT',
  'NOT_FOUND',
  'SESSION_EVICTED',
]);

function isRefusalCode(code: string): code is Extract<CallOutcome, { kind: 'refused' }>['code'] {
  return REFUSAL_CODES.has(code);
}

async function runIteration(
  runtime: Readonly<SequenceRuntime>,
  state: Readonly<SequenceState>,
  label: Readonly<StepLabel>,
): Promise<StepResult> {
  const outcome = await runReplayIteration(runtime.replayDeps, runtime.replayDeps.cache);

  const actual: string = match(outcome.kind)
    .with('idle', () => 'idle' as const)
    .with('matched', 'rejected', () => 'claimed' as const)
    .otherwise((kind) => kind);

  const expected = buildModelAfterIteration(state.model);

  if (actual !== expected.outcome) {
    return {
      failure: { ...label, actual, expected: expected.outcome, violations: ['iteration'] },
      kind: 'failed',
    };
  }

  if (expected.outcome === 'idle') {
    return { kind: 'passed', state };
  }

  return checkStep(runtime, label, { model: expected.model, previous: state.snapshot });
}
