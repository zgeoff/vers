import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData, CatchUpContinuation } from '@vers/contract-activity';
import type { ActivityServiceClient } from '../submission/types';

interface DrainOfflineBatchesOptions {
  readonly activity: ActivityData;
  readonly appendedHead: number;
  readonly batches: ReadonlyArray<ReadonlyArray<CatchUpContinuation>>;
  readonly client: Pick<ActivityServiceClient, 'advanceActivity'>;

  /**
   * Called once, on the first rejected batch, before this function returns — the caller's chance
   * to clear whatever optimistic reward reveals and xp tallies it showed for the unsent tail a
   * rejection discards. A device-key client must not keep showing loot the verifier will never
   * settle.
   */
  readonly onRejected?: () => void;
}

interface DrainOfflineBatchesResult {
  /**
   * The confirmed row and head as of the last batch that actually committed — the caller's
   * original `activity`/`appendedHead` when the very first batch was rejected, so a caller never
   * reports progress a rejection discarded.
   */
  readonly activity: ActivityData;
  readonly appendedHead: number;

  /**
   * False once any batch was rejected — the caller stops treating `activity`/`appendedHead` as the
   * end of a fully delivered plan and instead re-fetches through the outer resync.
   */
  readonly delivered: boolean;
}

/**
 * Ships bounded offline-catch-up batches to `advanceActivity`, sequentially and awaited — the
 * single owner of offline continuation delivery. It is never registered with the per-activity
 * `createCheckpointSubmitter`, whose `flushHeld` fans batches out with no cross-activity ordering;
 * two flushers over one queue would double-submit and could interleave. Ordering — batch N's mint
 * committing before batch N+1 ships — comes from awaiting each response before sending the next,
 * not from any assertion. A defined `advanceActivity` rejection discards every batch still unsent
 * and stops immediately: the confirmed row this function returns is whichever batch last
 * committed, exactly what the outer resync re-plans from. A transport failure carries no such
 * verdict — the server never rejected anything — so it propagates instead of resolving, reaching
 * the resync's own failure/retry path rather than reading as a displaced writer.
 */
export async function drainOfflineBatches(
  options: Readonly<DrainOfflineBatchesOptions>,
): Promise<DrainOfflineBatchesResult> {
  let activity = options.activity;
  let appendedHead = options.appendedHead;

  for (const batch of options.batches) {
    const [error, result] = await safe(
      options.client.advanceActivity({
        activityID: activity.id,
        continuations: batch,
        expectedHead: appendedHead,
      }),
    );

    if (error !== null) {
      if (!isDefinedError(error)) {
        throw error;
      }

      options.onRejected?.();

      return { activity, appendedHead, delivered: false };
    }

    activity = result.activity;
    appendedHead = result.appendedHead;
  }

  return { activity, appendedHead, delivered: true };
}
