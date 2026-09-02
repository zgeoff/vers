import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData, CatchUpContinuation } from '@vers/contract-activity';
import type { ActivityServiceClient } from '../submission/types';

interface DrainOfflineBatchesOptions {
  readonly activity: ActivityData;
  readonly appendedHead: number;
  readonly batches: ReadonlyArray<ReadonlyArray<CatchUpContinuation>>;
  readonly client: Pick<ActivityServiceClient, 'advanceActivity'>;

  readonly onRejected?: () => void;
}

interface DrainOfflineBatchesResult {
  readonly activity: ActivityData;
  readonly appendedHead: number;

  readonly delivered: boolean;
}

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
