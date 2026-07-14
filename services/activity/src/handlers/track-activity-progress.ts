import type { CheckpointBatchEntry, CheckpointPayload } from '@vers/contract-activity';
import { buildCheckpointHash } from '@vers/contract-activity';
import type { ActivityStatus, DB, Json } from '@vers/db';
import { levelForXP } from '@vers/idle-core';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import * as z from 'zod';
import type {
  CappedPayload,
  CheckpointInvalidPayload,
  EmptyErrorPayload,
  MissingSessionPayload,
  StaleHeadPayload,
  TerminalStatusPayload,
} from '../types';
import { updateAppendedAnchorFromTail } from './update-appended-anchor-from-tail';

interface TrackActivityProgressDeps {
  readonly db: Kysely<DB>;

  /**
   * Ceiling on the avatar's accrued simulated-time budget, in milliseconds.
   */
  readonly simTimeCapMs: number;
}

/**
 * oRPC handler opts for the authed `trackActivityProgress` procedure.
 */
interface TrackActivityProgressOpts {
  readonly context: {
    readonly actingSessionId: null | string;
    readonly actingUserId: null | string;
  };
  readonly errors: {
    readonly ACTIVITY_CAPPED: (payload: CappedPayload) => Error;
    readonly ACTIVITY_TERMINAL: (payload: TerminalStatusPayload) => Error;
    readonly CHECKPOINT_INVALID: (payload: CheckpointInvalidPayload) => Error;
    readonly CONFLICT: (payload: StaleHeadPayload) => Error;
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly SESSION_EVICTED: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: {
    readonly activityID: string;
    readonly checkpoints: ReadonlyArray<CheckpointBatchEntry>;
    readonly expectedHead: number;
  };
}

/**
 * Appends a checkpoint batch to an active activity owned by the acting user.
 *
 * The head-row compare-and-swap inside the transaction is the serialization point: a losing race
 * re-reads the head and resolves to NOT_FOUND, ACTIVITY_TERMINAL, SESSION_EVICTED (fatal — the
 * caller discards its pending queue), or CONFLICT (a retryable stale head).
 *
 * Only the stamped writer session may append; an unstamped activity is claimed by the first
 * appending session.
 *
 * A terminal last checkpoint (completed or failed) claims the activity's terminal transition in
 * the same transaction and settles the avatar's xp/level from its final rewards total — the claim
 * guards a duplicate resubmission against double-applying.
 *
 * Every accepted batch debits the avatar's simulated-time meter: the budget refills at wall-clock
 * rate up to the cap, and the batch's delta — the last checkpoint's cumulative `time` minus the
 * head row's accounted time — is consumed. A batch whose delta exceeds the accrued budget is
 * rejected whole; the activity claims the terminal `capped` transition at its current head, and
 * ACTIVITY_CAPPED carries that head as the index the caller rebases from after a resync.
 */
export async function trackActivityProgress(
  deps: TrackActivityProgressDeps,
  opts: TrackActivityProgressOpts,
): Promise<{ appendedHead: number }> {
  const actingUserID = opts.context.actingUserId;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const actingSessionID = opts.context.actingSessionId;
  const db = deps.db;

  const head = await db
    .selectFrom('activities')
    .innerJoin('avatars', 'avatars.id', 'activities.avatarId')
    .select([
      'activities.appendedHead',
      'activities.appendedTimeMs',
      'activities.avatarId',
      'activities.lastHash',
      'activities.scopeId',
      'activities.scopeType',
      'activities.startChainIndex',
      'activities.status',
      'activities.writerSessionId',
      'avatars.simBudgetMs',
      'avatars.simMeteredAt',
      'avatars.xp',
    ])

    // Cast to the meter columns' timestamp type so the driver parses both sides of the elapsed
    // subtraction identically regardless of session timezone.
    .select(sql<Date>`now()::timestamp`.as('meterReadAt'))
    .where('activities.id', '=', opts.input.activityID)
    .where('avatars.userId', '=', actingUserID)
    .executeTakeFirst();

  if (head === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (head.status !== 'active') {
    throw opts.errors.ACTIVITY_TERMINAL({
      data: { appendedHead: head.appendedHead, status: head.status },
    });
  }

  if (head.writerSessionId !== null && head.writerSessionId !== actingSessionID) {
    throw opts.errors.SESSION_EVICTED({ data: {} });
  }

  const appendedTimeMs = Number(head.appendedTimeMs);
  const reason = findInvalidReason(opts.input, { ...head, appendedTimeMs });

  if (reason !== undefined) {
    throw opts.errors.CHECKPOINT_INVALID({ data: { reason } });
  }

  const lastCheckpoint = opts.input.checkpoints.at(-1);
  const newHead = lastCheckpoint?.version ?? opts.input.expectedHead;
  const newLastHash = lastCheckpoint?.hash ?? head.lastHash;
  const newTimeMs = lastCheckpoint?.payload.time ?? appendedTimeMs;
  const timeDelta = newTimeMs - appendedTimeMs;
  const terminalRewardsXP = lastCheckpoint && findTerminalRewardsXP(lastCheckpoint.payload);

  // The budget decision is only meaningful against the head the batch claims to extend; a stale
  // batch falls through to the transaction's guarded update and resolves as CONFLICT.
  const headMatches = opts.input.expectedHead === head.appendedHead;

  const accruedMs =
    Number(head.simBudgetMs) + (head.meterReadAt.getTime() - head.simMeteredAt.getTime());

  const availableMs = Math.min(deps.simTimeCapMs, accruedMs);

  if (headMatches && timeDelta > availableMs) {
    // Its own transaction, not the append transaction: the append is rejected whole (nothing was
    // accepted, so no head, hash, or meter movement) while the capped transition and the chain's
    // consequent anchor advance commit together.
    const capOutcome = await db.transaction().execute(async (trx) => {
      const capped = await trx
        .updateTable('activities')
        .set({ status: 'capped', stoppedAt: sql`now()` })
        .where('id', '=', opts.input.activityID)
        .where('appendedHead', '=', opts.input.expectedHead)
        .where('status', '=', 'active')
        .where((eb) =>
          eb.or([eb('writerSessionId', 'is', null), eb('writerSessionId', '=', actingSessionID)]),
        )
        .returning(['appendedHead', 'lastHash'])
        .executeTakeFirst();

      if (capped === undefined) {
        const current = await trx
          .selectFrom('activities')
          .select(['appendedHead', 'status', 'writerSessionId'])
          .where('id', '=', opts.input.activityID)
          .executeTakeFirst();

        throw pickAppendRaceError(opts.errors, actingSessionID, current);
      }

      await updateAppendedAnchorFromTail(trx, {
        activityId: opts.input.activityID,
        appendedHead: capped.appendedHead,
        avatarId: head.avatarId,
        lastHash: capped.lastHash,
        scopeId: head.scopeId,
        scopeType: head.scopeType,
        startChainIndex: head.startChainIndex,
      });

      return capped.appendedHead;
    });

    throw opts.errors.ACTIVITY_CAPPED({ data: { appendedHead: capOutcome } });
  }

  const appendedHead = await db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable('activities')
      .set({
        appendedAt: sql`now()`,
        appendedHead: newHead,
        appendedTimeMs: Math.floor(newTimeMs),
        lastHash: newLastHash,
        ...(actingSessionID !== null && { writerSessionId: actingSessionID }),
        ...(terminalRewardsXP !== undefined && {
          status: 'stopped' as const,
          stoppedAt: sql`now()`,
        }),
      })
      .where('id', '=', opts.input.activityID)
      .where('appendedHead', '=', opts.input.expectedHead)
      .where('status', '=', 'active')
      .where((eb) =>
        eb.or([eb('writerSessionId', 'is', null), eb('writerSessionId', '=', actingSessionID)]),
      )
      .returning('appendedHead')
      .executeTakeFirst();

    if (updated === undefined) {
      const current = await trx
        .selectFrom('activities')
        .select(['appendedHead', 'status', 'writerSessionId'])
        .where('id', '=', opts.input.activityID)
        .executeTakeFirst();

      throw pickAppendRaceError(opts.errors, actingSessionID, current);
    }

    if (opts.input.checkpoints.length > 0) {
      await trx
        .insertInto('activityCheckpoints')
        .values(
          opts.input.checkpoints.map((checkpoint) => ({
            activityId: opts.input.activityID,
            hash: checkpoint.hash,
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; the value is schema-validated contract input
            payload: checkpoint.payload as Json,
            prevHash: checkpoint.prevHash,
            version: checkpoint.version,
          })),
        )
        .execute();
    }

    if (terminalRewardsXP !== undefined && lastCheckpoint !== undefined) {
      await updateAppendedAnchorFromTail(trx, {
        activityId: opts.input.activityID,
        appendedHead: newHead,
        avatarId: head.avatarId,
        lastHash: newLastHash,
        scopeId: head.scopeId,
        scopeType: head.scopeType,
        startChainIndex: head.startChainIndex,
      });

      const newXP = Math.max(0, Math.round(head.xp + terminalRewardsXP));

      const settled = await trx
        .updateTable('avatars')
        .set({ level: levelForXP(newXP), xp: newXP })
        .where('id', '=', head.avatarId)
        .where('xp', '=', head.xp)
        .executeTakeFirst();

      invariant(settled.numUpdatedRows > 0n, 'avatar settlement must apply exactly once');
    }

    if (timeDelta > 0) {
      // The refill is recomputed in SQL so the debit applies to the row's current values: the
      // projection only grows with time, and every other consumer for this avatar is excluded by
      // the head compare-and-swap this transaction already won, so the guard can only miss on a
      // bug.
      const debit = Math.ceil(timeDelta);
      const refill = sql`least(${deps.simTimeCapMs}, sim_budget_ms + (extract(epoch from (now() - sim_metered_at)) * 1000)::bigint)`;

      const consumed = await trx
        .updateTable('avatars')
        .set({
          simBudgetMs: sql`${refill} - ${debit}`,
          simMeteredAt: sql`now()`,
        })
        .where('id', '=', head.avatarId)
        .where(sql<boolean>`${refill} >= ${debit}`)
        .executeTakeFirst();

      invariant(consumed.numUpdatedRows > 0n, 'meter debit must apply once the append is won');
    }

    return updated.appendedHead;
  });

  return { appendedHead };
}

interface CheckpointBatchInput {
  readonly checkpoints: ReadonlyArray<CheckpointBatchEntry>;
  readonly expectedHead: number;
}

interface TrackActivityProgressHead {
  readonly appendedHead: number;
  readonly appendedTimeMs: number;
  readonly lastHash: string;
  readonly scopeId: string;
  readonly scopeType: string;
  readonly startChainIndex: number;
}

/**
 * Validates a checkpoint batch's internal shape ahead of the transactional head-row compare-and-swap: version
 * contiguity from `expectedHead + 1`, each entry's `chainIndex` continuity from
 * `head.startChainIndex`, each entry's cumulative `time` never regressing — within the batch
 * always, and from the head row's accounted time only when `expectedHead` still matches the head
 * row, since a stale batch predates that value — each entry's hash against its own payload, each
 * entry's chain link to the previous one, and (under the same head-match condition) the first
 * entry's link onto the current head.
 */
function findInvalidReason(
  input: Readonly<CheckpointBatchInput>,
  head: Readonly<TrackActivityProgressHead>,
): string | undefined {
  const headMatches = input.expectedHead === head.appendedHead;
  let previousTime = headMatches ? head.appendedTimeMs : undefined;

  for (const [index, checkpoint] of input.checkpoints.entries()) {
    const expectedVersion = input.expectedHead + index + 1;

    if (checkpoint.version !== expectedVersion) {
      return 'non-contiguous-versions';
    }

    if (checkpoint.payload.chainIndex !== head.startChainIndex + checkpoint.version) {
      return 'non-contiguous-chain-index';
    }

    // The negated >= also rejects a NaN time, which would otherwise slip through as a 0 delta.
    if (previousTime !== undefined && !(checkpoint.payload.time >= previousTime)) {
      return 'time-regression';
    }

    previousTime = checkpoint.payload.time;

    let previousHash: string | undefined;

    if (index === 0) {
      previousHash = headMatches ? head.lastHash : undefined;
    } else {
      previousHash = input.checkpoints[index - 1]?.hash;
    }

    if (previousHash !== undefined && checkpoint.prevHash !== previousHash) {
      return 'broken-chain-link';
    }

    const expectedHash = buildCheckpointHash({
      chainIndex: checkpoint.payload.chainIndex,
      entropySource: checkpoint.payload.entropySource,
      nextSeed: checkpoint.payload.nextSeed,
      prevHash: checkpoint.prevHash,
      seed: checkpoint.payload.seed,
      time: checkpoint.payload.time,
      type: checkpoint.payload.type,
      version: checkpoint.version,
    });

    if (expectedHash !== checkpoint.hash) {
      return 'hash-mismatch';
    }
  }

  return undefined;
}

interface AppendRaceRow {
  readonly appendedHead: number;
  readonly status: ActivityStatus;
  readonly writerSessionId: null | string;
}

/**
 * Picks the error a lost head-row race resolves to, from a fresh read of the activity row: gone,
 * terminal, writer taken over, or a retryable stale head.
 */
function pickAppendRaceError(
  errors: TrackActivityProgressOpts['errors'],
  actingSessionID: null | string,
  current: AppendRaceRow | undefined,
): Error {
  if (current === undefined) {
    return errors.NOT_FOUND({ data: {} });
  }

  if (current.status !== 'active') {
    return errors.ACTIVITY_TERMINAL({
      data: { appendedHead: current.appendedHead, status: current.status },
    });
  }

  if (current.writerSessionId !== null && current.writerSessionId !== actingSessionID) {
    return errors.SESSION_EVICTED({ data: {} });
  }

  return errors.CONFLICT({ data: { appendedHead: current.appendedHead } });
}

/**
 * Checkpoint types whose `rewards.xp` is a final running total the avatar row settles against.
 */
const TERMINAL_CHECKPOINT_TYPES = new Set(['completed', 'failed']);

const TerminalRewardsSchema = z.object({ xp: z.number() });

/**
 * The final rewards total a terminal checkpoint's payload carries, or `undefined` when the
 * checkpoint isn't terminal or its `rewards` shape doesn't parse — the latter settles no xp rather
 * than throwing, since the hash chain doesn't cover `rewards` and a malformed value isn't
 * distinguishable here from a stale or non-terminal client payload.
 */
function findTerminalRewardsXP(payload: Readonly<CheckpointPayload>): number | undefined {
  if (!TERMINAL_CHECKPOINT_TYPES.has(payload.type)) {
    return undefined;
  }

  const parsed = TerminalRewardsSchema.safeParse(payload['rewards']);

  return parsed.success ? parsed.data.xp : undefined;
}
