import type { CheckpointBatchEntry, CheckpointPayload } from '@vers/contract-activity';
import { RewardSlotSchema, buildCheckpointHash } from '@vers/contract-activity';
import type { ActivityStatus, DB, Json } from '@vers/db';
import { buildLevelFromXP } from '@vers/idle-core';
import type { ServiceContext } from '@vers/service-runtime';
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
    return checkAppendRace(db, opts);
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

    throw opts.errors.ACTIVITY_CAPPED({ data: { appendedHead: capOutcome.appendedHead } });
  }

  const appendedHead = await db.transaction().execute(async (trx) => {
    // Only a terminal batch advances the chain anchor; a batch that never touches the chain row
    // takes part in no lock ordering. When both rows are taken, the chain row comes first.
    if (terminalRewardsXP !== undefined) {
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
      const resolved = await checkAppendRace(trx, opts);

      return resolved.appendedHead;
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
        scopeId: head.scopeId,
        scopeType: head.scopeType,
        startChainIndex: head.startChainIndex,
      });

      const newXP = Math.max(0, Math.round(head.xp + terminalRewardsXP));

      const settled = await trx
        .updateTable('avatars')
        .set({ level: buildLevelFromXP(newXP), xp: newXP })
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

  const outcome = pickAppendRaceOutcome(
    opts.errors,
    opts.context.actingSessionId,
    current,
    opts.input.checkpoints,
  );

  if (outcome instanceof Error) {
    throw outcome;
  }

  opts.context.logger.info(
    { activityID: opts.input.activityID },
    'settled batch re-acknowledged after a dropped ack',
  );

  return { appendedHead: outcome.appendedHead };
}

interface SettledTailRow {
  readonly appendedHead: number;
  readonly lastHash: string;
}

/**
 * Reports whether a checkpoint batch, replayed from scratch, recomputes onto a settled activity's
 * recorded tail: the last entry's version lands on `settled.appendedHead`, and every entry's hash —
 * rebuilt via `buildCheckpointHash`, never trusted from the submitted `hash` field — chains onto
 * the previous entry's rebuilt hash and the final one reproduces `settled.lastHash`. A match proves
 * the recorded tail is this exact batch: the original submit landed and only the ack was lost.
 */
function isSettledResubmit(
  checkpoints: ReadonlyArray<CheckpointBatchEntry>,
  settled: Readonly<SettledTailRow>,
): boolean {
  const lastCheckpoint = checkpoints.at(-1);

  if (lastCheckpoint === undefined || lastCheckpoint.version !== settled.appendedHead) {
    return false;
  }

  let previousHash: string | undefined;

  for (const checkpoint of checkpoints) {
    if (previousHash !== undefined && checkpoint.prevHash !== previousHash) {
      return false;
    }

    previousHash = buildCheckpointHash({
      chainIndex: checkpoint.payload.chainIndex,
      entropySource: checkpoint.payload.entropySource,
      nextSeed: checkpoint.payload.nextSeed,
      prevHash: checkpoint.prevHash,
      seed: checkpoint.payload.seed,
      time: checkpoint.payload.time,
      type: checkpoint.payload.type,
      version: checkpoint.version,
    });
  }

  return previousHash === settled.lastHash;
}

interface TerminalRow extends SettledTailRow {
  readonly status: ActivityStatus;
}

/**
 * Resolves a non-active head: a resubmit that recomputes onto the recorded tail settles as the
 * already-settled head, a normal success; any other batch against a terminal status resolves
 * ACTIVITY_TERMINAL.
 */
function pickTerminalOutcome(
  checkpoints: ReadonlyArray<CheckpointBatchEntry>,
  current: Readonly<TerminalRow>,
  errors: TrackActivityProgressOpts['errors'],
): { readonly appendedHead: number } | Error {
  if (isSettledResubmit(checkpoints, current)) {
    return { appendedHead: current.appendedHead };
  }

  return errors.ACTIVITY_TERMINAL({
    data: { appendedHead: current.appendedHead, status: current.status },
  });
}

const RewardSlotsSchema = z.array(RewardSlotSchema);

/**
 * A checkpoint's `rewardSlots` field rides outside the hashed subset like `rewards`, so it's
 * validated here rather than by `CheckpointPayloadSchema`. Absent is valid — an older client or a
 * checkpoint that dropped nothing carries no key at all. Present, it must parse and its ordinals
 * must run contiguous from 0 in list order.
 */
function findRewardSlotsInvalidReason(payload: Readonly<CheckpointPayload>): string | undefined {
  if (!('rewardSlots' in payload)) {
    return undefined;
  }

  const parsed = RewardSlotsSchema.safeParse(payload['rewardSlots']);

  if (!parsed.success) {
    return 'invalid-reward-slots';
  }

  const isContiguous = parsed.data.every((slot, index) => slot.ordinal === index);

  return isContiguous ? undefined : 'invalid-reward-slots';
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
 * `head.startChainIndex`, each entry's optional `rewardSlots` shape and ordinal contiguity, each
 * entry's cumulative `time` never regressing — within the batch always, and from the head row's
 * accounted time only when `expectedHead` still matches the head row, since a stale batch predates
 * that value — each entry's hash against its own payload, each entry's chain link to the previous
 * one, and (under the same head-match condition) the first entry's link onto the current head.
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

    const rewardSlotsReason = findRewardSlotsInvalidReason(checkpoint.payload);

    if (rewardSlotsReason !== undefined) {
      return rewardSlotsReason;
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

interface AppendRaceRow extends TerminalRow {
  readonly writerSessionId: null | string;
}

/**
 * Resolves a lost head-row race from a fresh read of the activity row: gone (NOT_FOUND), terminal
 * (a matching resubmit settles, otherwise ACTIVITY_TERMINAL), writer taken over (SESSION_EVICTED),
 * or a retryable stale head (CONFLICT).
 */
function pickAppendRaceOutcome(
  errors: TrackActivityProgressOpts['errors'],
  actingSessionID: null | string,
  current: AppendRaceRow | undefined,
  checkpoints: ReadonlyArray<CheckpointBatchEntry>,
): { readonly appendedHead: number } | Error {
  if (current === undefined) {
    return errors.NOT_FOUND({ data: {} });
  }

  if (current.status !== 'active') {
    return pickTerminalOutcome(checkpoints, current, errors);
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
