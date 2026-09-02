import type {
  ActivityData,
  AdvanceCheckpointInvalidReason,
  BuildSnapshot,
  CatchUpContinuation,
  ContentDocument,
  EncounterNode,
  OfflineActivityStartSubmission,
} from '@vers/contract-activity';
import { EncounterNodeSchema, buildStartHash } from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import type { Activities, ActivityStatus, DB } from '@vers/db';
import { toJSON } from '@vers/db';
import { buildLevelFromXP, isTerminalCheckpointType } from '@vers/idle-core';
import type { CryptoKey } from 'jose';
import { sql } from 'kysely';
import type { Kysely, Selectable } from 'kysely';
import invariant from 'tiny-invariant';
import { findCheckpointBatchInvalidReason } from '../find-checkpoint-batch-invalid-reason';
import { getOptimisticBuild } from '../get-optimistic-build';
import { isUniqueViolation } from '../is-unique-violation';
import { recordAdvanceBailout } from '../metrics/record-advance-bailout';
import { recordAdvanceContinuation } from '../metrics/record-advance-continuation';
import { recordTerminalTransition } from '../metrics/record-terminal-transition';
import { pickCheckpointBatchRaceOutcome } from '../pick-checkpoint-batch-race-outcome';
import type {
  AdvanceBailPayload,
  AdvanceCheckpointInvalidPayload,
  AdvanceTerminalPayload,
  AvatarNotActivePayload,
  EmptyErrorPayload,
  MissingSessionPayload,
  SimVersionProblemPayload,
} from '../types';
import { admitActivityStart } from './admit-activity-start';
import { toActivityData } from './to-activity-data';
import { updateAppendedAnchorFromTail } from './update-appended-anchor-from-tail';

interface AdvanceActivityDeps {
  readonly db: Kysely<DB>;
  readonly keysServiceURL: string;
  readonly keyVersion: number;
  readonly loadContentDocument: (contentVersion: string) => Promise<ContentDocument | undefined>;
  readonly privateKey: CryptoKey;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
  readonly sendReplayWake: () => void;

  readonly simTimeCapMs: number;
}

interface AdvanceActivityOpts {
  readonly context: {
    readonly actingSessionID: null | string;
    readonly actingUserID: null | string;
  };
  readonly errors: {
    readonly ACTIVITY_CAPPED: (payload: AdvanceBailPayload) => Error;
    readonly ACTIVITY_TERMINAL: (payload: AdvanceTerminalPayload) => Error;
    readonly AVATAR_NOT_ACTIVE: (payload: AvatarNotActivePayload) => Error;
    readonly CHAIN_QUARANTINED: (payload: AdvanceBailPayload) => Error;
    readonly CHECKPOINT_INVALID: (payload: AdvanceCheckpointInvalidPayload) => Error;
    readonly CONFLICT: (payload: AdvanceBailPayload) => Error;
    readonly NODE_NOT_REVEALED: (payload: EmptyErrorPayload) => Error;
    readonly NODE_UNKNOWN: (payload: EmptyErrorPayload) => Error;
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly SESSION_EVICTED: (payload: AdvanceBailPayload) => Error;
    readonly SIM_VERSION_EXPIRED: (payload: SimVersionProblemPayload) => Error;
    readonly SIM_VERSION_UNKNOWN: (payload: SimVersionProblemPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: {
    readonly activityID: string;
    readonly continuations: ReadonlyArray<CatchUpContinuation>;
    readonly expectedHead: number;
    readonly activityStart?: OfflineActivityStartSubmission | undefined;
  };
}

export async function advanceActivity(
  deps: AdvanceActivityDeps,
  opts: AdvanceActivityOpts,
): Promise<{ activity: ActivityData; appendedHead: number }> {
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const actingSessionID = opts.context.actingSessionID;

  const activityStartRow = await resolveActivityStartRow(deps, opts, actingUserID, actingSessionID);

  const pinned: PinnedActivityContext = {
    avatarId: activityStartRow.avatarId,
    contentVersion: activityStartRow.contentVersion,
    encounterNode: EncounterNodeSchema.parse(activityStartRow.encounterNode),
    keyVersion: activityStartRow.keyVersion,
    scopeId: activityStartRow.scopeId,
    scopeType: activityStartRow.scopeType,
    secretRef: activityStartRow.secretRef,
    secretVersion: activityStartRow.secretVersion,
    simVersion: activityStartRow.simVersion,
  };

  let targetActivityID = opts.input.activityID;
  let targetExpectedHead = opts.input.expectedHead;
  let finalRow: Selectable<Activities> = activityStartRow;

  for (const continuation of opts.input.continuations) {
    const stepActivityID = targetActivityID;
    const stepExpectedHead = targetExpectedHead;
    let minted: MintedContinuation;

    try {
      minted = await runContinuation(deps, pinned, {
        actingSessionID,
        continuation,
        targetActivityID: stepActivityID,
        targetExpectedHead: stepExpectedHead,
      });
    } catch (error: unknown) {
      if (error instanceof ContinuationBailError) {
        recordAdvanceBailout(BAILOUT_REASONS[error.outcome.kind]);
        throw buildBailError(opts.errors, error.outcome);
      }

      if (!isUniqueViolation(error)) {
        throw error;
      }

      // The mint's insert lost to another row already minted at this client id — resolved here,
      // outside any transaction, since the one that just rolled back cannot run another
      // statement once a constraint violation has poisoned it.
      const recovered = await resolveMintIDCollision(deps.db, pinned, continuation);

      if (recovered === undefined) {
        recordAdvanceBailout('conflict');

        throw buildBailError(opts.errors, {
          activityID: stepActivityID,
          appendedHead: stepExpectedHead,
          kind: 'conflict',
        });
      }

      minted = recovered;
    }

    recordAdvanceContinuation(minted.mintOutcome);

    deps.sendReplayWake();

    targetActivityID = minted.row.id;
    targetExpectedHead = 0;
    finalRow = minted.row;
  }

  return { activity: toActivityData(finalRow), appendedHead: finalRow.appendedHead };
}

async function resolveActivityStartRow(
  deps: AdvanceActivityDeps,
  opts: AdvanceActivityOpts,
  actingUserID: string,
  actingSessionID: null | string,
): Promise<Selectable<Activities>> {
  const initial = await deps.db
    .selectFrom('activities')
    .innerJoin('avatars', 'avatars.id', 'activities.avatarId')
    .selectAll('activities')
    .where('activities.id', '=', opts.input.activityID)
    .where('avatars.userId', '=', actingUserID)
    .executeTakeFirst();

  if (initial !== undefined) {
    return initial;
  }

  const activityStart = opts.input.activityStart;

  if (activityStart === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const avatar = await deps.db
    .selectFrom('avatars')
    .select('id')
    .where('id', '=', activityStart.avatarID)
    .where('userId', '=', actingUserID)
    .executeTakeFirst();

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  // The owner-scoped `initial` read misses a row at this id owned by another user; a row present
  // here is exactly that, so it stays NOT_FOUND rather than reaching the mint and surfacing as the
  // unique-violation CONFLICT — which would tell a caller the foreign id exists.
  const foreign = await deps.db
    .selectFrom('activities')
    .select('id')
    .where('id', '=', opts.input.activityID)
    .executeTakeFirst();

  if (foreign !== undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  try {
    return await deps.db.transaction().execute((trx) =>
      admitActivityStart(
        {
          keyVersion: deps.keyVersion,
          keysServiceURL: deps.keysServiceURL,
          loadContentDocument: deps.loadContentDocument,
          privateKey: deps.privateKey,
          secretRef: deps.secretRef,
          secretVersion: deps.secretVersion,
        },
        trx,
        actingUserID,
        { activityID: opts.input.activityID, actingSessionID, activityStart },
        opts.errors,
      ),
    );
  } catch (error: unknown) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    // The mint's insert lost to another row already minted at this client id — resolved here,
    // outside any transaction, since the one that just rolled back cannot run another statement
    // once a constraint violation has poisoned it.
    const recovered = await resolveActivityStartAdmissionCollision(
      deps.db,
      activityStart,
      opts.input.activityID,
    );

    if (recovered === undefined) {
      recordAdvanceBailout('conflict');

      throw opts.errors.CONFLICT({
        data: { activityID: opts.input.activityID, appendedHead: 0 },
      });
    }

    return recovered;
  }
}

async function resolveActivityStartAdmissionCollision(
  db: Kysely<DB>,
  activityStart: Readonly<OfflineActivityStartSubmission>,
  activityID: string,
): Promise<Selectable<Activities> | undefined> {
  const existing = await db
    .selectFrom('activities')
    .selectAll()
    .where('id', '=', activityID)
    .executeTakeFirst();

  if (
    existing === undefined ||
    existing.avatarId !== activityStart.avatarID ||
    existing.startKey !== activityStart.startKey ||
    existing.scopeType !== activityStart.scopeType ||
    existing.scopeId !== activityStart.scopeID
  ) {
    return undefined;
  }

  return existing;
}

interface PinnedActivityContext {
  readonly avatarId: string;
  readonly contentVersion: string;
  readonly encounterNode: Readonly<EncounterNode>;
  readonly keyVersion: number;
  readonly scopeId: string;
  readonly scopeType: string;
  readonly secretRef: string;
  readonly secretVersion: number;
  readonly simVersion: string;
}

interface MintedContinuation {
  readonly mintOutcome: 'converged' | 'minted';
  readonly row: Selectable<Activities>;
}

type BailOutcome =
  | { readonly activityID: string; readonly appendedHead: number; readonly kind: 'capped' }
  | {
      readonly activityID: string;
      readonly appendedHead: number;
      readonly kind: 'chain-quarantined';
    }
  | {
      readonly activityID: string;
      readonly appendedHead: number;
      readonly kind: 'checkpoint-invalid';
      readonly reason: AdvanceCheckpointInvalidReason;
    }
  | { readonly activityID: string; readonly appendedHead: number; readonly kind: 'conflict' }
  | { readonly activityID: string; readonly appendedHead: number; readonly kind: 'session-evicted' }
  | {
      readonly activityID: string;
      readonly appendedHead: number;
      readonly kind: 'terminal';
      readonly status: ActivityStatus;
    };

// a throw is the only way to roll a continuation back: Kysely's transaction().execute() commits on
// any normal return, whatever the value
class ContinuationBailError extends Error {
  readonly outcome: BailOutcome;

  constructor(outcome: Readonly<BailOutcome>) {
    super(`advanceActivity continuation bailed: ${outcome.kind}`);

    this.name = 'ContinuationBailError';
    this.outcome = outcome;
  }
}

const BAILOUT_REASONS = {
  capped: 'activity_capped',
  'chain-quarantined': 'chain_quarantined',
  'checkpoint-invalid': 'checkpoint_invalid',
  conflict: 'conflict',
  'session-evicted': 'session_evicted',
  terminal: 'terminal',
} as const;

function buildBailError(
  errors: AdvanceActivityOpts['errors'],
  outcome: Readonly<BailOutcome>,
): Error {
  switch (outcome.kind) {
    case 'chain-quarantined': {
      return errors.CHAIN_QUARANTINED({
        data: { activityID: outcome.activityID, appendedHead: outcome.appendedHead },
      });
    }

    case 'capped': {
      return errors.ACTIVITY_CAPPED({
        data: { activityID: outcome.activityID, appendedHead: outcome.appendedHead },
      });
    }

    case 'checkpoint-invalid': {
      return errors.CHECKPOINT_INVALID({
        data: {
          activityID: outcome.activityID,
          appendedHead: outcome.appendedHead,
          reason: outcome.reason,
        },
      });
    }

    case 'conflict': {
      return errors.CONFLICT({
        data: { activityID: outcome.activityID, appendedHead: outcome.appendedHead },
      });
    }

    case 'session-evicted': {
      return errors.SESSION_EVICTED({
        data: { activityID: outcome.activityID, appendedHead: outcome.appendedHead },
      });
    }

    case 'terminal': {
      return errors.ACTIVITY_TERMINAL({
        data: {
          activityID: outcome.activityID,
          appendedHead: outcome.appendedHead,
          status: outcome.status,
        },
      });
    }

    // every BailOutcome kind is handled above; a raw throw here (rather than `invariant`) is what
    // satisfies the linter's return-consistency check across an exhaustive switch
    default: {
      throw new Error(`unreachable BailOutcome kind: ${JSON.stringify(outcome)}`);
    }
  }
}

interface RunContinuationInput {
  readonly actingSessionID: null | string;
  readonly continuation: Readonly<CatchUpContinuation>;
  readonly targetActivityID: string;
  readonly targetExpectedHead: number;
}

async function runContinuation(
  deps: AdvanceActivityDeps,
  pinned: Readonly<PinnedActivityContext>,
  input: Readonly<RunContinuationInput>,
): Promise<MintedContinuation> {
  // The target read and its structural validation run outside any transaction, matching
  // trackActivityProgress's own shape, so a rejection found here needs no rollback.
  const target = await deps.db
    .selectFrom('activities')
    .innerJoin('avatars', 'avatars.id', 'activities.avatarId')
    .select([
      'activities.appendedHead',
      'activities.appendedTimeMs',
      'activities.lastHash',
      'activities.startChainIndex',
      'activities.status',
      'activities.writerSessionId',
      'avatars.simBudgetMs',
      'avatars.simMeteredAt',
    ])

    // Cast to the meter columns' timestamp type so the driver parses both sides of the elapsed
    // subtraction identically regardless of session timezone.
    .select(sql<Date>`now()::timestamp`.as('meterReadAt'))
    .where('activities.id', '=', input.targetActivityID)
    .executeTakeFirst();

  invariant(target !== undefined, 'a continuation target row must exist once minted');

  const appendedTimeMs = Number(target.appendedTimeMs);

  if (target.status !== 'active') {
    const raceOutcome = pickCheckpointBatchRaceOutcome(
      input.actingSessionID,
      target,
      input.continuation.checkpoints,
    );

    if (raceOutcome.kind !== 'resubmit-settled') {
      invariant(
        raceOutcome.kind === 'terminal',
        'a non-active head resolves only settled or terminal',
      );

      throw new ContinuationBailError({
        activityID: input.targetActivityID,
        appendedHead: raceOutcome.appendedHead,
        kind: 'terminal',
        status: raceOutcome.status,
      });
    }

    // The tail already landed in an earlier, partially committed request — nothing left to
    // append. Only the mint may still be outstanding, so fall through to it, in its own
    // transaction — no append precedes it here to roll back alongside a rejected mint.
    return deps.db.transaction().execute((trx) => mintContinuation(trx, input, pinned));
  }

  if (target.writerSessionId !== null && target.writerSessionId !== input.actingSessionID) {
    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: target.appendedHead,
      kind: 'session-evicted',
    });
  }

  const reason = findCheckpointBatchInvalidReason(
    { checkpoints: input.continuation.checkpoints, expectedHead: input.targetExpectedHead },
    { ...target, appendedTimeMs },
  );

  if (reason !== undefined) {
    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: target.appendedHead,
      kind: 'checkpoint-invalid',
      reason,
    });
  }

  const lastCheckpoint = input.continuation.checkpoints.at(-1);

  invariant(lastCheckpoint !== undefined, 'a continuation always carries at least one checkpoint');

  if (!isTerminalCheckpointType(lastCheckpoint.payload.type)) {
    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: target.appendedHead,
      kind: 'checkpoint-invalid',
      reason: 'continuation-not-terminal',
    });
  }

  const newTimeMs = lastCheckpoint.payload.time;
  const timeDelta = newTimeMs - appendedTimeMs;

  const accruedMs =
    Number(target.simBudgetMs) + (target.meterReadAt.getTime() - target.simMeteredAt.getTime());

  const availableMs = Math.min(deps.simTimeCapMs, accruedMs);

  if (timeDelta > availableMs) {
    const capOutcome = await deps.db.transaction().execute(async (trx) => {
      // Chain row before activity row — the one lock order every writer that touches both shares.
      await trx
        .selectFrom('activityChains')
        .select('appendedChainIndex')
        .where('avatarId', '=', pinned.avatarId)
        .where('scopeType', '=', pinned.scopeType)
        .where('scopeId', '=', pinned.scopeId)
        .forUpdate()
        .execute();

      const capped = await trx
        .updateTable('activities')
        .set({ status: 'capped', stoppedAt: sql`now()` })
        .where('id', '=', input.targetActivityID)
        .where('appendedHead', '=', input.targetExpectedHead)
        .where('status', '=', 'active')
        .where((eb) =>
          eb.or([
            eb('writerSessionId', 'is', null),
            eb('writerSessionId', '=', input.actingSessionID),
          ]),
        )
        .returning('appendedHead')
        .executeTakeFirst();

      if (capped === undefined) {
        return { kind: 'resolved' as const, minted: await resolveLostRace(trx, pinned, input) };
      }

      await updateAppendedAnchorFromTail(trx, {
        activityId: input.targetActivityID,
        appendedHead: capped.appendedHead,
        avatarId: pinned.avatarId,
        scopeId: pinned.scopeId,
        scopeType: pinned.scopeType,
        startChainIndex: target.startChainIndex,
      });

      return { appendedHead: capped.appendedHead, kind: 'capped' as const };
    });

    if (capOutcome.kind === 'resolved') {
      return capOutcome.minted;
    }

    recordTerminalTransition('capped');

    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: capOutcome.appendedHead,
      kind: 'capped',
    });
  }

  const outcome = await deps.db.transaction().execute(async (trx) => {
    // Chain row before activity row — the one lock order every writer that touches both shares.
    await trx
      .selectFrom('activityChains')
      .select('appendedChainIndex')
      .where('avatarId', '=', pinned.avatarId)
      .where('scopeType', '=', pinned.scopeType)
      .where('scopeId', '=', pinned.scopeId)
      .forUpdate()
      .execute();

    const updated = await trx
      .updateTable('activities')
      .set({
        appendedAt: sql`now()`,
        appendedHead: lastCheckpoint.version,
        appendedTimeMs: Math.floor(newTimeMs),
        lastHash: lastCheckpoint.hash,
        status: 'stopped',
        stoppedAt: sql`now()`,
        ...(input.actingSessionID !== null && { writerSessionId: input.actingSessionID }),
      })
      .where('id', '=', input.targetActivityID)
      .where('appendedHead', '=', input.targetExpectedHead)
      .where('status', '=', 'active')
      .where((eb) =>
        eb.or([
          eb('writerSessionId', 'is', null),
          eb('writerSessionId', '=', input.actingSessionID),
        ]),
      )
      .returning('appendedHead')
      .executeTakeFirst();

    if (updated === undefined) {
      return { kind: 'resolved' as const, minted: await resolveLostRace(trx, pinned, input) };
    }

    await trx
      .insertInto('activityCheckpoints')
      .values(
        input.continuation.checkpoints.map((checkpoint) => ({
          activityId: input.targetActivityID,
          hash: checkpoint.hash,
          payload: toJSON(checkpoint.payload),
          prevHash: checkpoint.prevHash,
          version: checkpoint.version,
        })),
      )
      .execute();

    await updateAppendedAnchorFromTail(trx, {
      activityId: input.targetActivityID,
      appendedHead: updated.appendedHead,
      avatarId: pinned.avatarId,
      scopeId: pinned.scopeId,
      scopeType: pinned.scopeType,
      startChainIndex: target.startChainIndex,
    });

    if (timeDelta > 0) {
      // the same debit formula the live append path uses, recomputed against the row's committed
      // values: each continuation commits its own transaction, so the next one's read already sees
      // this debit applied
      const debit = Math.ceil(timeDelta);
      const refill = sql`least(${deps.simTimeCapMs}, sim_budget_ms + (extract(epoch from (now() - sim_metered_at)) * 1000)::bigint)`;

      const consumed = await trx
        .updateTable('avatars')
        .set({ simBudgetMs: sql`${refill} - ${debit}`, simMeteredAt: sql`now()` })
        .where('id', '=', pinned.avatarId)
        .where(sql<boolean>`${refill} >= ${debit}`)
        .executeTakeFirst();

      invariant(consumed.numUpdatedRows > 0n, 'meter debit must apply once the append is won');
    }

    return { kind: 'stopped' as const, minted: await mintContinuation(trx, input, pinned) };
  });

  // Recorded only after the transaction commits: a statement failure after the guarded update
  // rolls the transition back, and a counter incremented inside the transaction would still count
  // it.
  if (outcome.kind === 'stopped') {
    recordTerminalTransition('stopped');
  }

  return outcome.minted;
}

async function resolveLostRace(
  trx: Kysely<DB>,
  pinned: Readonly<PinnedActivityContext>,
  input: Readonly<RunContinuationInput>,
): Promise<MintedContinuation> {
  const current = await trx
    .selectFrom('activities')
    .select(['appendedHead', 'lastHash', 'status', 'writerSessionId'])
    .where('id', '=', input.targetActivityID)
    .executeTakeFirst();

  invariant(current !== undefined, 'a continuation target row must exist once minted');

  const raceOutcome = pickCheckpointBatchRaceOutcome(
    input.actingSessionID,
    current,
    input.continuation.checkpoints,
  );

  if (raceOutcome.kind === 'resubmit-settled') {
    return mintContinuation(trx, input, pinned);
  }

  if (raceOutcome.kind === 'session-evicted') {
    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: current.appendedHead,
      kind: 'session-evicted',
    });
  }

  if (raceOutcome.kind === 'terminal') {
    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: raceOutcome.appendedHead,
      kind: 'terminal',
      status: raceOutcome.status,
    });
  }

  throw new ContinuationBailError({
    activityID: input.targetActivityID,
    appendedHead: current.appendedHead,
    kind: 'conflict',
  });
}

async function mintContinuation(
  trx: Kysely<DB>,
  input: Readonly<RunContinuationInput>,
  pinned: Readonly<PinnedActivityContext>,
): Promise<MintedContinuation> {
  const quarantined = await trx
    .selectFrom('activities')
    .select('id')
    .where('avatarId', '=', pinned.avatarId)
    .where('scopeType', '=', pinned.scopeType)
    .where('scopeId', '=', pinned.scopeId)
    .where('status', '=', 'quarantined')
    .executeTakeFirst();

  if (quarantined !== undefined) {
    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: input.targetExpectedHead,
      kind: 'chain-quarantined',
    });
  }

  const chain = await trx
    .selectFrom('activityChains')
    .select(['appendedNextSeed', 'appendedChainIndex'])
    .where('avatarId', '=', pinned.avatarId)
    .where('scopeType', '=', pinned.scopeType)
    .where('scopeId', '=', pinned.scopeId)
    .executeTakeFirstOrThrow();

  const seed = chain.appendedNextSeed;

  const optimistic = await getOptimisticBuild(trx, pinned.avatarId);

  const buildSnapshot: BuildSnapshot = {
    level: buildLevelFromXP(optimistic.totalXP),
    xp: optimistic.totalXP,
  };

  const continuation = input.continuation;

  if (
    buildSnapshot.level !== continuation.buildSnapshot.level ||
    buildSnapshot.xp !== continuation.buildSnapshot.xp
  ) {
    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: input.targetExpectedHead,
      kind: 'checkpoint-invalid',
      reason: 'build-snapshot-mismatch',
    });
  }

  const startHash = buildStartHash({
    contentVersion: pinned.contentVersion,
    encounterNode: pinned.encounterNode,
    keyVersion: pinned.keyVersion,
    seed,
    simVersion: pinned.simVersion,
  });

  const row = await trx
    .insertInto('activities')
    .values({
      avatarId: pinned.avatarId,
      buildSnapshot,
      contentVersion: pinned.contentVersion,
      encounterNode: pinned.encounterNode,
      id: continuation.id,
      keyVersion: pinned.keyVersion,
      lastHash: startHash,
      predecessorActivityId: input.targetActivityID,
      scopeId: pinned.scopeId,
      scopeType: pinned.scopeType,
      secretRef: pinned.secretRef,
      secretVersion: pinned.secretVersion,
      seed,
      simVersion: pinned.simVersion,
      startChainIndex: chain.appendedChainIndex,
      startHash,
      startKey: continuation.startKey,
      writerSessionId: input.actingSessionID,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { mintOutcome: 'minted', row };
}

async function resolveMintIDCollision(
  db: Kysely<DB>,
  pinned: Readonly<PinnedActivityContext>,
  continuation: Readonly<CatchUpContinuation>,
): Promise<MintedContinuation | undefined> {
  const existing = await db
    .selectFrom('activities')
    .selectAll()
    .where('id', '=', continuation.id)
    .executeTakeFirst();

  if (
    existing === undefined ||
    existing.avatarId !== pinned.avatarId ||
    existing.startKey !== continuation.startKey ||
    existing.scopeType !== pinned.scopeType ||
    existing.scopeId !== pinned.scopeId
  ) {
    return undefined;
  }

  return { mintOutcome: 'converged', row: existing };
}
