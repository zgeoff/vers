import { readPendingStartIntent } from '../submission/read-pending-start-intent';
import { flushPendingStop } from './flush-pending-stop';
import { runResyncTurn } from './run-resync-turn';
import type { WorkerContext } from './types';

/**
 * The worker's one decision point for self-scheduled catch-ups, run on every connectivity proof:
 * resends whatever the submitter held, delivers a stop raised offline, then — once the held tail
 * is drained, so a resync never reads a stale appended head — resyncs while no run is live. The
 * avatar comes from the durable start intent first (recorded at the most recent boundary
 * failure), else the reporting tab's session avatar, else the last avatar a resync ran for; with
 * none of the three, there is nothing to catch up. An intent's avatar can be stale — the account
 * switched away from it while the intent was held — so the reporting tab's session avatar or the
 * last resync avatar is carried along as a fallback the resync flow falls back to in the same
 * call, and the account's real active avatar still gets its catch-up this cycle rather than
 * waiting for the next connectivity proof. `claim` carries a reporting tab's deliberate presence
 * into the resync so it may take an active run's writer; the worker's own triggers — a reconnect,
 * a flush answer — never claim.
 */
export async function runReconnectRecovery(
  context: WorkerContext,
  signalAvatarID?: string,
  claim = false,
): Promise<void> {
  await context.getSubmitter().flushHeld();

  // A stop raised offline delivers here even when no resync will follow — the self-resync below
  // runs only while no run is live.
  await flushPendingStop(context);

  const heldIntent = await readPendingStartIntent();

  const rememberedAvatarID = signalAvatarID ?? context.getResyncAvatarID() ?? undefined;
  const avatarID = heldIntent?.avatarID ?? rememberedAvatarID ?? null;

  if (context.getActivity() === null && avatarID !== null) {
    const fallbackAvatarID = heldIntent === undefined ? undefined : rememberedAvatarID;

    await runResyncTurn(context, avatarID, claim, fallbackAvatarID);
  }
}
