import type { CheckpointBatchEntry, CheckpointPayload } from '@vers/contract-activity';
import { buildCheckpointHash } from '@vers/contract-activity';
import type { DB, Json } from '@vers/db';
import { levelForXP } from '@vers/idle-core';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import * as z from 'zod';
import type {
  CheckpointInvalidPayload,
  EmptyErrorPayload,
  MissingSessionPayload,
  StaleHeadPayload,
  TerminalStatusPayload,
} from '../types';

/**
 * oRPC handler opts for the authed `trackActivityProgress` procedure.
 */
interface TrackActivityProgressOpts {
  readonly context: {
    readonly actingSessionId: null | string;
    readonly actingUserId: null | string;
  };
  readonly errors: {
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
 * Appends a checkpoint batch to an active activity owned by the acting user. The batch's internal
 * contiguity and hash chain are validated up front; the head-row compare-and-swap inside the
 * transaction is the actual serialization point — a losing race re-reads the current head and
 * reports NOT_FOUND (activity gone), ACTIVITY_TERMINAL (a terminal status accepts no appends),
 * SESSION_EVICTED (another session took over as the writer — fatal, the caller discards its
 * pending queue), or CONFLICT (a retryable stale head). The writer fence admits only the stamped
 * writer session; an unstamped activity is claimed by the first appending session. When the
 * batch's last checkpoint is terminal (completed or failed), the same transaction claims the
 * activity's terminal transition and settles the avatar's xp/level from that checkpoint's final
 * rewards total — the claim guards against a duplicate terminal resubmission double-applying.
 */
export async function trackActivityProgress(
  db: Kysely<DB>,
  opts: TrackActivityProgressOpts,
): Promise<{ appendedHead: number }> {
  const actingUserID = opts.context.actingUserId;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const actingSessionID = opts.context.actingSessionId;

  const head = await db
    .selectFrom('activities')
    .innerJoin('avatars', 'avatars.id', 'activities.avatarId')
    .select([
      'activities.appendedHead',
      'activities.avatarId',
      'activities.lastHash',
      'activities.scopeId',
      'activities.scopeType',
      'activities.startChainIndex',
      'activities.status',
      'activities.writerSessionId',
      'avatars.xp',
    ])
    .where('activities.id', '=', opts.input.activityID)
    .where('avatars.userId', '=', actingUserID)
    .executeTakeFirst();

  if (head === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (head.status !== 'active') {
    throw opts.errors.ACTIVITY_TERMINAL({ data: { status: head.status } });
  }

  if (head.writerSessionId !== null && head.writerSessionId !== actingSessionID) {
    throw opts.errors.SESSION_EVICTED({ data: {} });
  }

  const reason = findInvalidReason(opts.input, head);

  if (reason !== undefined) {
    throw opts.errors.CHECKPOINT_INVALID({ data: { reason } });
  }

  const lastCheckpoint = opts.input.checkpoints.at(-1);
  const newHead = lastCheckpoint?.version ?? opts.input.expectedHead;
  const newLastHash = lastCheckpoint?.hash ?? head.lastHash;
  const terminalRewardsXP = lastCheckpoint && findTerminalRewardsXP(lastCheckpoint.payload);

  const appendedHead = await db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable('activities')
      .set({
        appendedAt: sql`now()`,
        appendedHead: newHead,
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

      if (current === undefined) {
        throw opts.errors.NOT_FOUND({ data: {} });
      }

      if (current.status !== 'active') {
        throw opts.errors.ACTIVITY_TERMINAL({ data: { status: current.status } });
      }

      if (current.writerSessionId !== null && current.writerSessionId !== actingSessionID) {
        throw opts.errors.SESSION_EVICTED({ data: {} });
      }

      throw opts.errors.CONFLICT({ data: { appendedHead: current.appendedHead } });
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
      await trx
        .updateTable('activityChains')
        .set({
          appendedChainIndex: lastCheckpoint.payload.chainIndex,
          appendedNextSeed: lastCheckpoint.payload.nextSeed,
        })
        .where('avatarId', '=', head.avatarId)
        .where('scopeType', '=', head.scopeType)
        .where('scopeId', '=', head.scopeId)
        .where('appendedChainIndex', '=', head.startChainIndex)
        .execute();

      const newXP = Math.max(0, Math.round(head.xp + terminalRewardsXP));

      const settled = await trx
        .updateTable('avatars')
        .set({ level: levelForXP(newXP), xp: newXP })
        .where('id', '=', head.avatarId)
        .where('xp', '=', head.xp)
        .executeTakeFirst();

      invariant(settled.numUpdatedRows > 0n, 'avatar settlement must apply exactly once');
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
  readonly lastHash: string;
  readonly scopeId: string;
  readonly scopeType: string;
  readonly startChainIndex: number;
}

/**
 * Validates a checkpoint batch's internal shape ahead of the transactional head-row CAS: version
 * contiguity from `expectedHead + 1`, each entry's `chainIndex` continuity from
 * `head.startChainIndex`, each entry's hash against its own payload, each entry's chain link to
 * the previous one, and — only when `expectedHead` still matches the head row, since a stale
 * batch's chain has nothing to link onto — the first entry's link onto the current head.
 */
function findInvalidReason(
  input: Readonly<CheckpointBatchInput>,
  head: Readonly<TrackActivityProgressHead>,
): string | undefined {
  const headMatches = input.expectedHead === head.appendedHead;

  for (const [index, checkpoint] of input.checkpoints.entries()) {
    const expectedVersion = input.expectedHead + index + 1;

    if (checkpoint.version !== expectedVersion) {
      return 'non-contiguous-versions';
    }

    if (checkpoint.payload.chainIndex !== head.startChainIndex + checkpoint.version) {
      return 'non-contiguous-chain-index';
    }

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
