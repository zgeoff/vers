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
 * Attempts delivery of the held continuation-start intent, installing nothing itself — the
 * resync that follows fetches the minted row (`started`) and attaches it through normal
 * planning. Another avatar's intent is left untouched: delivering it would mint a row this
 * resync never attaches. A spent budget skips the attempt (`capped`); whether that is a real
 * halt or a stale intent is the caller's call, from fetched progress. Same-key deliveries dedupe
 * server-side, so a same-row `CONFLICT` means the terminal append hasn't landed (`blocked`) and
 * any other `CONFLICT` is a different claim (`stale`). An auth rejection keeps the intent — the
 * session lapsing says nothing about the continuation — while any other defined rejection is the
 * service declaring it dead; both rethrow into the caller's failure handling. A stop landing
 * mid-call has the minted row stopped back durably (`stopped`).
 */
export async function flushPendingStart(
  context: WorkerContext,
  entryEpoch: number,
  avatarID: string,
): Promise<PendingStartFlushResult> {
  const intent = await readPendingStartIntent();

  if (intent === undefined || intent.avatarID !== avatarID) {
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

  if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
    throw error;
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
