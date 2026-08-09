import type { ActivityData, BuildSnapshot, CatchUpContinuation } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import type { Activities, ActivityStatus, DB, Json } from '@vers/db';
import { buildLevelFromXP, isTerminalCheckpointType } from '@vers/idle-core';
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
  EmptyErrorPayload,
  MissingSessionPayload,
} from '../types';
import { toActivityData } from './to-activity-data';
import { updateAppendedAnchorFromTail } from './update-appended-anchor-from-tail';

interface AdvanceActivityDeps {
  readonly db: Kysely<DB>;
  readonly sendReplayWake: () => void;

  /**
   * Cap on the avatar's accrued simulated-time budget, in milliseconds — the same limit
   * `trackActivityProgress` enforces, applied once per continuation's own committed transaction.
   */
  readonly simTimeCapMs: number;
}

/**
 * oRPC handler opts for the authed `advanceActivity` procedure.
 */
interface AdvanceActivityOpts {
  readonly context: {
    readonly actingSessionId: null | string;
    readonly actingUserId: null | string;
  };
  readonly errors: {
    readonly ACTIVITY_CAPPED: (payload: AdvanceBailPayload) => Error;
    readonly ACTIVITY_TERMINAL: (payload: AdvanceTerminalPayload) => Error;
    readonly CHAIN_QUARANTINED: (payload: AdvanceBailPayload) => Error;
    readonly CHECKPOINT_INVALID: (payload: AdvanceCheckpointInvalidPayload) => Error;
    readonly CONFLICT: (payload: AdvanceBailPayload) => Error;
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly SESSION_EVICTED: (payload: AdvanceBailPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: {
    readonly activityID: string;
    readonly continuations: ReadonlyArray<CatchUpContinuation>;
    readonly expectedHead: number;
  };
}

/**
 * Bulk mint-and-appends an offline catch-up: each `continuations` entry appends its tail onto
 * whichever row is currently active — `activityID` for the first entry, otherwise the row the
 * previous entry minted — and, once that append lands terminal, mints the entry's own
 * `id`/`startKey`/`buildSnapshot` as the next row, ready for the following entry's tail. Every
 * continuation always ends terminal by construction: the client only ever submits a full attempt,
 * never a partial one, so each entry both closes a row and opens the next.
 *
 * `contentVersion`, `keyVersion`, `simVersion`, `encounterNode`, and `secretRef`/`secretVersion` are
 * inherited once from `activityID`'s own row and reused for every mint in this request — never
 * re-resolved from the service's current deploy or the world map — so the whole offline gap
 * replays under the exact engine, content, and encounter the client's own local simulation was
 * pinned to, and every minted row stays eligible for the replay verifier's descriptor check.
 *
 * Each continuation is its own transaction: append, then (on terminal) mint — reusing
 * `trackActivityProgress`'s head compare-and-swap, meter debit, and terminal anchor advance, and
 * `startActivity`'s chain-seed read and provenance recording. A rejection at either step unwinds
 * the whole transaction, so the confirmed head reported on any bail is always the last fully
 * committed continuation's — never a partial append with no successor. The mint step authors
 * `buildSnapshot` itself server-side; the entry's own `buildSnapshot` is only a cross-check hint,
 * and a mismatch bails with `CHECKPOINT_INVALID` — a client-supplied snapshot the server stored
 * as-is would be direct xp inflation. Mint dedup keys on the entry's own `id` plus a matching
 * `startKey` and scope, never on id and ownership alone, resolved outside any transaction once
 * the insert's unique violation has unwound one; `startActivity`'s own dedup (the active-status
 * row for the avatar) would find nothing and stall forever once a gap has already ended terminal.
 */
export async function advanceActivity(
  deps: AdvanceActivityDeps,
  opts: AdvanceActivityOpts,
): Promise<{ activity: ActivityData; appendedHead: number }> {
  const actingUserID = opts.context.actingUserId;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const actingSessionID = opts.context.actingSessionId;

  const initial = await deps.db
    .selectFrom('activities')
    .innerJoin('avatars', 'avatars.id', 'activities.avatarId')
    .selectAll('activities')
    .where('activities.id', '=', opts.input.activityID)
    .where('avatars.userId', '=', actingUserID)
    .executeTakeFirst();

  if (initial === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const pinned: PinnedActivityContext = {
    avatarId: initial.avatarId,
    contentVersion: initial.contentVersion,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; every write is this service's own encounter-node resolution
    encounterNode: initial.encounterNode as {
      readonly difficulty: number;
      readonly poolID?: string;
    },
    keyVersion: initial.keyVersion,
    scopeId: initial.scopeId,
    scopeType: initial.scopeType,
    secretRef: initial.secretRef,
    secretVersion: initial.secretVersion,
    simVersion: initial.simVersion,
  };

  let targetActivityID = opts.input.activityID;
  let targetExpectedHead = opts.input.expectedHead;
  let finalRow: Selectable<Activities> = initial;

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

/**
 * The fields every mint in a request inherits from `activityID`'s own row rather than re-resolving
 * per continuation.
 */
interface PinnedActivityContext {
  readonly avatarId: string;
  readonly contentVersion: string;
  readonly encounterNode: { readonly difficulty: number; readonly poolID?: string };
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
      readonly reason: string;
    }
  | { readonly activityID: string; readonly appendedHead: number; readonly kind: 'conflict' }
  | { readonly activityID: string; readonly appendedHead: number; readonly kind: 'session-evicted' }
  | {
      readonly activityID: string;
      readonly appendedHead: number;
      readonly kind: 'terminal';
      readonly status: ActivityStatus;
    };

/**
 * Thrown to reject a continuation from inside its own transaction, unwinding whatever it appended
 * or minted so far — the mechanism, not a return value, that makes a rejected continuation roll
 * back: `db.transaction().execute()` commits on any normal return regardless of the value, and
 * only a throw triggers its rollback.
 */
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

/**
 * Maps a bail outcome onto its typed contract error.
 */
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

/**
 * Runs one continuation: append its tail onto the target row, then — because every tail ends
 * terminal by construction — mint its own id as the next row. The target read and its structural
 * validation run outside any transaction, matching `trackActivityProgress`'s own shape, so a
 * rejection found there needs no rollback. The cap decision and the append-and-mint each open
 * their own top-level transaction. A cap commits on its own: its terminal transition is honest
 * progress independent of this continuation's fate, exactly as `trackActivityProgress` commits it
 * apart from the append it rejects. An append and its following mint share one transaction, so a
 * rejected mint rolls the append back with it.
 */
async function runContinuation(
  deps: AdvanceActivityDeps,
  pinned: Readonly<PinnedActivityContext>,
  input: Readonly<RunContinuationInput>,
): Promise<MintedContinuation> {
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
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; the value is schema-validated contract input
          payload: checkpoint.payload as Json,
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
      // The same debit formula `trackActivityProgress` uses, recomputed against the row's
      // currently committed values: because each continuation is its own committed transaction,
      // the next one's read already sees this debit applied, composing the running account
      // across the whole request without a separate running total.
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

/**
 * Resolves a continuation's guarded update losing its compare-and-swap, from a fresh read of the
 * target row. A resubmit that recomputes onto the row's recorded tail has already landed in an
 * earlier, partially committed request — only the mint may still be outstanding, so this falls
 * through to it exactly as a target that already reads non-active does. Every other outcome bails
 * with the row's own current head — the row the client re-plans from.
 */
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

/**
 * Mints a continuation's own id as the row appended onto in this request's next step.
 * Server-authors `buildSnapshot` from the avatar's settled-plus-unsettled progression and rejects
 * with `CHECKPOINT_INVALID` on a mismatch against the continuation's hint. The insert's own unique
 * violation — an id already minted by an earlier attempt at this same continuation — propagates
 * uncaught: this transaction is about to commit everything before it, so a caught-and-recovered
 * duplicate here would need a second statement in a connection Postgres has already poisoned. The
 * caller resolves that collision instead, once this transaction's rollback has landed.
 */
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

  if (optimistic.sourceIDs.length > 0) {
    await trx
      .insertInto('activitySnapshotSources')
      .values(
        optimistic.sourceIDs.map((sourceID) => ({
          activityId: continuation.id,
          sourceActivityId: sourceID,
        })),
      )
      .execute();
  }

  return { mintOutcome: 'minted', row };
}

/**
 * Resolves a mint's unique violation, from a fresh connection once the transaction that hit it has
 * rolled back: an existing row at the continuation's id converges only when it is the continuation
 * this request is retrying — owned by this avatar, minted from the same `startKey`, and scoped to
 * the same chain — a resubmit of a request whose mint already committed and whose response was
 * lost. A row that merely shares the id but not that provenance (a reused or aliased
 * id landing on an unrelated activity) is rejected exactly like a foreign-owned or missing row:
 * `undefined`, a conflict the caller reports rather than a row it adopts as the next append target.
 */
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
