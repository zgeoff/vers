import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import { readPendingStartIntent } from '../submission/read-pending-start-intent';
import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
import { BUNDLED_ENGINE_HASH } from './bundled-engine-hash';
import { submitStopIntent } from './submit-stop-intent';
import type { FlowSignals, WorkerContext } from './types';

export type PendingStartFlushResult =
  | {
      readonly outcome:
        | 'blocked'
        | 'capped'
        | 'none'
        | 'sim-version-expired'
        | 'stale'
        | 'stopped'
        | 'undelivered';
    }
  | {
      readonly activeAvatarID: string;
      readonly activeAvatarName: string;
      readonly outcome: 'avatar-switched';
    }
  | { readonly outcome: 'delivered'; readonly started: Readonly<ActivityData> };

/**
 * Attempts delivery of the held continuation-start intent, installing nothing itself — the
 * resync that follows fetches the minted row (`started`) and attaches it through normal
 * planning. Another avatar's intent is left untouched: delivering it would mint a row this
 * resync never attaches. A spent budget skips the attempt (`capped`); whether that is a real
 * halt or a stale intent is the caller's call, from fetched progress. Same-key deliveries dedupe
 * server-side, so a same-row `CONFLICT` means the terminal append hasn't landed (`blocked`) and
 * any other `CONFLICT` is a different claim (`stale`). `AVATAR_NOT_ACTIVE` means the account
 * switched avatars while the intent was held: the intent is dropped and the outcome carries the
 * account's actual active avatar's id and name (`avatar-switched`) — the caller's authoritative
 * recovery target, not a value it must derive itself. `SIM_VERSION_EXPIRED` and
 * `SIM_VERSION_UNKNOWN` mean this build's engine no longer replays the current content: the intent
 * is dropped, since only a reload can deliver it (`sim-version-expired`). An auth rejection keeps
 * the intent — the session lapsing says nothing about the continuation — while any other defined
 * rejection is the service declaring it dead; both rethrow into the caller's failure handling. A
 * stop landing mid-call has the minted row stopped back durably (`stopped`).
 */
export async function flushPendingStart(
  context: WorkerContext,
  signals: Readonly<FlowSignals>,
  avatarID: string,
): Promise<PendingStartFlushResult> {
  const intent = await readPendingStartIntent();

  if (intent === undefined || intent.avatarID !== avatarID) {
    return { outcome: 'none' };
  }

  if (context.getRemainingBudgetMs() <= 0) {
    return { outcome: 'capped' };
  }

  // runs unsigned: the response is the only handle on the minted row, and the stop-back
  // compensation needs it
  const [error, started] = await safe(
    context.getClient().startActivity({
      avatarID: intent.avatarID,
      scopeID: intent.scopeID,
      scopeType: intent.scopeType,
      simVersion: BUNDLED_ENGINE_HASH,
      startKey: `continue_${intent.activityID}`,
    }),
  );

  if (error === null) {
    if (signals.stop.aborted) {
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

  if (error.code === 'AVATAR_NOT_ACTIVE') {
    await removePendingStartIntent(intent.activityID);

    return {
      activeAvatarID: error.data.activeAvatarID,
      activeAvatarName: error.data.activeAvatarName,
      outcome: 'avatar-switched',
    };
  }

  // a swept hash reads back unknown rather than expired — either way the remedy is the same
  // reload, and the intent is dropped: the bundled engine that would replay it is the one refused
  if (error.code === 'SIM_VERSION_EXPIRED' || error.code === 'SIM_VERSION_UNKNOWN') {
    await removePendingStartIntent(intent.activityID);

    return { outcome: 'sim-version-expired' };
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
