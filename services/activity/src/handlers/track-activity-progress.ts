import type { CheckpointBatchEntry } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import { toJSON } from '@vers/db';
import { isTerminalCheckpointType } from '@vers/idle-core';
import type { ServiceContext } from '@vers/service-runtime';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import { findCheckpointBatchInvalidReason } from '../find-checkpoint-batch-invalid-reason';
import { recordTerminalTransition } from '../metrics/record-terminal-transition';
import { pickCheckpointBatchRaceOutcome } from '../pick-checkpoint-batch-race-outcome';
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
  readonly sendReplayWake: () => void;

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
    readonly actingSessionID: null | string;
    readonly actingUserID: null | string;
    readonly logger: ServiceContext['logger'];
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
 * A terminal last checkpoint (completed or failed) claims the activity's terminal transition and
 * advances the chain's appended anchor in the same transaction — the claim guards a duplicate
 * resubmission against double-applying. Settlement of the avatar's xp/level lives behind the
 * verifier, not here: this path only records what was appended.
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
  const actingUserID = opts.context.actingUserID;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const actingSessionID = opts.context.actingSessionID;
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
    return checkAppendRace(db, opts);
  }

  if (head.writerSessionId !== null && head.writerSessionId !== actingSessionID) {
    throw opts.errors.SESSION_EVICTED({ data: {} });
  }

  const appendedTimeMs = Number(head.appendedTimeMs);
  const reason = findCheckpointBatchInvalidReason(opts.input, { ...head, appendedTimeMs });

  if (reason !== undefined) {
    throw opts.errors.CHECKPOINT_INVALID({ data: { reason } });
  }

  const lastCheckpoint = opts.input.checkpoints.at(-1);
  const newHead = lastCheckpoint?.version ?? opts.input.expectedHead;
  const newLastHash = lastCheckpoint?.hash ?? head.lastHash;
  const newTimeMs = lastCheckpoint?.payload.time ?? appendedTimeMs;
  const timeDelta = newTimeMs - appendedTimeMs;

  // The type alone decides, matching the rule a verifier replays against. `rewards` is outside the
  // hash and the settled figure comes from the replayed checkpoint, so a run that ends still ends
  // however its client wrote that field.
  const isTerminalBatch =
    lastCheckpoint !== undefined && isTerminalCheckpointType(lastCheckpoint.payload.type);

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
      // Chain row before activity row — the one lock order every writer that touches both shares.
      await trx
        .selectFrom('activityChains')
        .select('appendedChainIndex')
        .where('avatarId', '=', head.avatarId)
        .where('scopeType', '=', head.scopeType)
        .where('scopeId', '=', head.scopeId)
        .forUpdate()
        .execute();

      const capped = await trx
        .updateTable('activities')
        .set({ status: 'capped', stoppedAt: sql`now()` })
        .where('id', '=', opts.input.activityID)
        .where('appendedHead', '=', opts.input.expectedHead)
        .where('status', '=', 'active')
        .where((eb) =>
          eb.or([eb('writerSessionId', 'is', null), eb('writerSessionId', '=', actingSessionID)]),
        )
        .returning('appendedHead')
        .executeTakeFirst();

      if (capped === undefined) {
        const resolved = await checkAppendRace(trx, opts);

        return { appendedHead: resolved.appendedHead, kind: 'resolved' } as const;
      }

      await updateAppendedAnchorFromTail(trx, {
        activityId: opts.input.activityID,
        appendedHead: capped.appendedHead,
        avatarId: head.avatarId,
        scopeId: head.scopeId,
        scopeType: head.scopeType,
        startChainIndex: head.startChainIndex,
      });

      return { appendedHead: capped.appendedHead, kind: 'capped' } as const;
    });

    if (capOutcome.kind === 'resolved') {
      return { appendedHead: capOutcome.appendedHead };
    }

    recordTerminalTransition('capped');

    deps.sendReplayWake();
    throw opts.errors.ACTIVITY_CAPPED({ data: { appendedHead: capOutcome.appendedHead } });
  }

  const appendOutcome = await db.transaction().execute(async (trx) => {
    // Only a terminal batch advances the chain anchor; a batch that never touches the chain row
    // takes part in no lock ordering. When both rows are taken, the chain row comes first.
    if (isTerminalBatch) {
      await trx
        .selectFrom('activityChains')
        .select('appendedChainIndex')
        .where('avatarId', '=', head.avatarId)
        .where('scopeType', '=', head.scopeType)
        .where('scopeId', '=', head.scopeId)
        .forUpdate()
        .execute();
    }

    const updated = await trx
      .updateTable('activities')
      .set({
        appendedAt: sql`now()`,
        appendedHead: newHead,
        appendedTimeMs: Math.floor(newTimeMs),
        lastHash: newLastHash,
        ...(actingSessionID !== null && { writerSessionId: actingSessionID }),
        ...(isTerminalBatch && {
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
      const resolved = await checkAppendRace(trx, opts);

      return { appendedHead: resolved.appendedHead, kind: 'resolved' } as const;
    }

    if (opts.input.checkpoints.length > 0) {
      await trx
        .insertInto('activityCheckpoints')
        .values(
          opts.input.checkpoints.map((checkpoint) => ({
            activityId: opts.input.activityID,
            hash: checkpoint.hash,
            payload: toJSON(checkpoint.payload),
            prevHash: checkpoint.prevHash,
            version: checkpoint.version,
          })),
        )
        .execute();
    }

    if (isTerminalBatch) {
      await updateAppendedAnchorFromTail(trx, {
        activityId: opts.input.activityID,
        appendedHead: newHead,
        avatarId: head.avatarId,
        scopeId: head.scopeId,
        scopeType: head.scopeType,
        startChainIndex: head.startChainIndex,
      });
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

    return {
      appendedHead: updated.appendedHead,
      kind: isTerminalBatch ? 'stopped' : 'appended',
    } as const;
  });

  // Recorded only after the transaction commits: a statement failure after the guarded update
  // rolls the transition back, and a counter incremented inside the transaction would still count
  // it.
  if (appendOutcome.kind === 'stopped') {
    recordTerminalTransition('stopped');
  }

  if (appendOutcome.kind !== 'resolved') {
    deps.sendReplayWake();
  }

  return { appendedHead: appendOutcome.appendedHead };
}

/**
 * Resolves a batch that lost its guarded update, from a fresh read of the activity row. A batch
 * that recomputes onto the settled tail is a dropped-ack retry: it re-acknowledges with the
 * recorded head — logged, no writes. Every other outcome throws its typed error.
 */
async function checkAppendRace(
  db: Kysely<DB>,
  opts: TrackActivityProgressOpts,
): Promise<{ appendedHead: number }> {
  const current = await db
    .selectFrom('activities')
    .select(['appendedHead', 'lastHash', 'status', 'writerSessionId'])
    .where('id', '=', opts.input.activityID)
    .executeTakeFirst();

  const outcome = pickCheckpointBatchRaceOutcome(
    opts.context.actingSessionID,
    current,
    opts.input.checkpoints,
  );

  switch (outcome.kind) {
    case 'not-found': {
      throw opts.errors.NOT_FOUND({ data: {} });
    }

    case 'session-evicted': {
      throw opts.errors.SESSION_EVICTED({ data: {} });
    }

    case 'terminal': {
      throw opts.errors.ACTIVITY_TERMINAL({
        data: { appendedHead: outcome.appendedHead, status: outcome.status },
      });
    }

    case 'conflict': {
      throw opts.errors.CONFLICT({ data: { appendedHead: outcome.appendedHead } });
    }

    case 'resubmit-settled': {
      break;
    }
  }

  opts.context.logger.info(
    { activityID: opts.input.activityID },
    'settled batch re-acknowledged after a dropped ack',
  );

  return { appendedHead: outcome.appendedHead };
}
