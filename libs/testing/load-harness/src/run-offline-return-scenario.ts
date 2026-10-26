import { safe } from '@orpc/client';
import { createId } from '@paralleldrive/cuid2';
import { MAX_CATCH_UP_BATCH_CHECKPOINTS } from '@vers/contract-activity';
import {
  drainOfflineBatches,
  planOfflineContinuations,
  splitContinuationsIntoBatches,
} from '@vers/idle-client/headless';
import { ActivityFailureAction, buildSimulationInput } from '@vers/idle-core';
import { sql } from 'kysely';
import invariant from 'tiny-invariant';
import { buildPlayerProfiles } from './build-player-profiles';
import { createConnectedPlayers } from './create-connected-players';
import { createLoadSampler } from './create-load-sampler';
import { parseLockWaits } from './parse-lock-waits';
import { readReconciliation } from './read-reconciliation';
import { runActivityAttempt } from './run-activity-attempt';
import type {
  CallLog,
  ConnectedPlayer,
  LoadStack,
  ScenarioEvent,
  ScenarioRecording,
} from './types';
import { waitForSettlement } from './wait-for-settlement';
import { writePlayerAccounts } from './write-player-accounts';

interface RunOfflineReturnScenarioOptions {
  readonly name: string;
  readonly offlineMs: number;
  readonly players: number;
  readonly retainedEvery: number;
  readonly sampleIntervalMs: number;
  readonly settleTimeoutMs: number;
}

// a margin past the gap, so the budget each avatar banked covers the whole planned return
const BUDGET_MARGIN_MS = 5 * 60 * 1000;

// every player closed the game on a fresh activity and reopens it after the same gap at the same
// moment, so the window holds the fast-forward deliveries and the settlement of all of them
export async function runOfflineReturnScenario(
  stack: Readonly<LoadStack>,
  options: Readonly<RunOfflineReturnScenarioOptions>,
): Promise<ScenarioRecording> {
  const profiles = buildPlayerProfiles({
    count: options.players,
    firstIndex: 0,
    retainedEvery: options.retainedEvery,
    versions: stack.versions,
  });

  const accounts = await writePlayerAccounts(stack.db, profiles, options.name);

  const callLog: CallLog = { calls: [], refusals: [] };

  const connected = await createConnectedPlayers(stack, accounts, callLog);

  for (const player of connected) {
    await writeClosedActivity(player);
  }

  await stack.db
    .updateTable('avatars')
    .set({
      simMeteredAt: sql`now() - ${options.offlineMs + BUDGET_MARGIN_MS} * interval '1 millisecond'`,
    })
    .execute();

  const planned = await Promise.all(
    connected.map((player) => planReturn(player, options.offlineMs)),
  );

  const events: Array<ScenarioEvent> = [];

  callLog.calls.length = 0;

  const windowStartedAt = new Date();

  const sampler = createLoadSampler({
    containerPrefix: stack.containerPrefix,
    db: stack.db,
    intervalMs: options.sampleIntervalMs,
  });

  const startedAt = performance.now();

  events.push({ elapsedMs: 0, label: `${options.players} players return together` });

  await Promise.all(
    planned.map(async (plan) => {
      const [error, drained] = await safe(
        drainOfflineBatches({
          activity: plan.progress.activity,
          appendedHead: plan.progress.appendedHead,
          batches: plan.batches,
          client: plan.player.client,
        }),
      );

      if (error !== null) {
        callLog.refusals.push({ code: 'UNDELIVERED', procedure: 'advanceActivity' });
      } else if (!drained.delivered) {
        callLog.refusals.push({ code: 'REFUSED', procedure: 'advanceActivity' });
      }
    }),
  );

  const playMs = performance.now() - startedAt;

  events.push({ elapsedMs: playMs, label: 'every return delivered' });

  const settleMs = await waitForSettlement(stack.db, options.settleTimeoutMs);
  const recording = await sampler.stop();
  const postgresLog = await stack.readLogs('postgres', windowStartedAt);
  const reconciliation = await readReconciliation(stack.db, accounts, new Map());

  return {
    calls: callLog.calls,
    events,
    lockWaits: parseLockWaits(postgresLog),
    name: options.name,
    players: options.players,
    playMs,
    reconciliation,
    recording,
    refusals: callLog.refusals,
    settleMs,
  };
}

// the activity the player left running when the game closed: admitted, with nothing appended
async function writeClosedActivity(player: ConnectedPlayer): Promise<void> {
  const run = await runActivityAttempt({
    activityID: `act_${createId()}`,
    avatarID: player.account.avatarID,
    buildSnapshot: player.buildSnapshot,
    chain: player.chain,
    content: player.content,
    playedAt: new Date(),
    predecessorActivityID: null,
    simVersion: player.account.profile.simVersion,
  });

  await player.client.advanceActivity({
    activityID: run.id,
    activityStart: run.start,
    continuations: [],
    expectedHead: 0,
  });
}

interface PlannedReturn {
  readonly batches: ReturnType<typeof splitContinuationsIntoBatches>;
  readonly player: ConnectedPlayer;
  readonly progress: Awaited<ReturnType<ConnectedPlayer['client']['getLatestActivityProgress']>>;
}

async function planReturn(player: ConnectedPlayer, offlineMs: number): Promise<PlannedReturn> {
  const progress = await player.client.getLatestActivityProgress({
    avatarID: player.account.avatarID,
  });

  const plan = await planOfflineContinuations({
    budgetMs: offlineMs,
    loadSimulationInput: (source) =>
      Promise.resolve(
        buildSimulationInput(player.content, source, {
          failureAction: ActivityFailureAction.Retry,
        }),
      ),
    progress,
  });

  invariant(
    plan.planned.length > 0,
    'a gap longer than one attempt plans at least one continuation',
  );

  return {
    batches: splitContinuationsIntoBatches(
      plan.planned.map((entry) => entry.continuation),
      MAX_CATCH_UP_BATCH_CHECKPOINTS,
    ),
    player,
    progress,
  };
}
