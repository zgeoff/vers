import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import { readPendingStartIntent } from '../submission/read-pending-start-intent';
import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
import { hasStopIntervened } from './has-stop-intervened';
import { submitStopIntent } from './submit-stop-intent';
import type { WorkerContext } from './types';

export type PendingStartFlushResult =
  | { readonly outcome: 'blocked' | 'capped' | 'none' | 'stale' | 'stopped' | 'undelivered' }
  | { readonly outcome: 'delivered'; readonly started: Readonly<ActivityData> };

/**
 * Attempts delivery of the held continuation-start intent, installing nothing itself — a resync
 * that follows finds the row the delivery minted (returned as `started`) and attaches it through
 * its normal planning. A spent offline budget skips the attempt outright (`capped`), leaving the
 * caller to decide from fetched progress whether the intent is genuinely halted or just stale. A
 * `CONFLICT` naming the intent's own source row means its terminal append hasn't landed yet
 * (`blocked` — the intent stays for a later attempt); any other conflicting row is a genuinely
 * different claim on the avatar, which makes the intent stale — duplicate deliveries of the same
 * intent dedupe server-side on the start key, so they never read as conflicts. Any other defined
 * rejection is the service answering that the intent is dead: the record clears and the error
 * rethrows into the caller's failure handling. A transport failure keeps the intent held
 * (`undelivered`). A stop that lands while the start call is in flight has the freshly minted row
 * stopped back durably (`stopped`) — the run it was raised for no longer exists.
 */
export async function flushPendingStart(
  context: WorkerContext,
  entryEpoch: number,
): Promise<PendingStartFlushResult> {
  const intent = await readPendingStartIntent();

  if (intent === undefined) {
    return { outcome: 'none' };
  }

  if (context.getRemainingBudgetMs() <= 0) {
    return { outcome: 'capped' };
  }

  const [error, started] = await safe(
    context.getClient().startActivity({
      avatarID: intent.avatarID,
      scopeID: intent.scopeID,
      scopeType: intent.scopeType,
      startKey: `continue_${intent.activityID}`,
    }),
  );

  if (error === null) {
    if (hasStopIntervened(context, entryEpoch)) {
      await submitStopIntent(context, started);
      await removePendingStartIntent(intent.activityID);

      return { outcome: 'stopped' };
    }

    await removePendingStartIntent(intent.activityID);

    return { outcome: 'delivered', started };
  }

  if (!isDefinedError(error)) {
    return { outcome: 'undelivered' };
  }

  if (error.code !== 'CONFLICT') {
    await removePendingStartIntent(intent.activityID);

    throw error;
  }

  if (error.data.activity.id === intent.activityID) {
    return { outcome: 'blocked' };
  }

  await removePendingStartIntent(intent.activityID);

  return { outcome: 'stale' };
}
