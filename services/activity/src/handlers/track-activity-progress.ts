import type { CheckpointBatchEntry } from '@vers/contract-activity';
import { buildCheckpointHash } from '@vers/contract-activity';
import type { DB, Json } from '@vers/db';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import type {
  CheckpointInvalidPayload,
  EmptyErrorPayload,
  MissingSessionPayload,
  StaleHeadPayload,
} from '../types';

/**
 * oRPC handler opts for the authed `trackActivityProgress` procedure.
 */
interface TrackActivityProgressOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly CHECKPOINT_INVALID: (payload: CheckpointInvalidPayload) => Error;
    readonly CONFLICT: (payload: StaleHeadPayload) => Error;
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
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
 * reports NOT_FOUND (activity gone or no longer active) or CONFLICT (a retryable stale head) as
 * appropriate.
 */
export async function trackActivityProgress(
  db: Kysely<DB>,
  opts: TrackActivityProgressOpts,
): Promise<{ appendedHead: number }> {
  const actingUserID = opts.context.actingUserId;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const head = await db
    .selectFrom('activities')
    .innerJoin('avatars', 'avatars.id', 'activities.avatarId')
    .select(['activities.appendedHead', 'activities.lastHash'])
    .where('activities.id', '=', opts.input.activityID)
    .where('avatars.userId', '=', actingUserID)
    .where('activities.status', '=', 'active')
    .executeTakeFirst();

  if (head === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const reason = findInvalidReason(opts.input, head);

  if (reason !== undefined) {
    throw opts.errors.CHECKPOINT_INVALID({ data: { reason } });
  }

  const lastCheckpoint = opts.input.checkpoints.at(-1);
  const newHead = lastCheckpoint?.version ?? opts.input.expectedHead;
  const newLastHash = lastCheckpoint?.hash ?? head.lastHash;

  const appendedHead = await db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable('activities')
      .set({ appendedAt: sql`now()`, appendedHead: newHead, lastHash: newLastHash })
      .where('id', '=', opts.input.activityID)
      .where('appendedHead', '=', opts.input.expectedHead)
      .where('status', '=', 'active')
      .returning('appendedHead')
      .executeTakeFirst();

    if (updated === undefined) {
      const current = await trx
        .selectFrom('activities')
        .select(['appendedHead', 'status'])
        .where('id', '=', opts.input.activityID)
        .executeTakeFirst();

      if (current === undefined || current.status !== 'active') {
        throw opts.errors.NOT_FOUND({ data: {} });
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
}

/**
 * Validates a checkpoint batch's internal shape ahead of the transactional head-row CAS: version
 * contiguity from `expectedHead + 1`, each entry's hash against its own payload, each entry's
 * chain link to the previous one, and — only when `expectedHead` still matches the head row, since
 * a stale batch's chain has nothing to link onto — the first entry's link onto the current head.
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
