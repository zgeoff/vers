import { readPendingStartIntent } from '../submission/read-pending-start-intent';
import { drainStartRows } from './drain-start-rows';
import { flushPendingStop } from './flush-pending-stop';
import { reportWorkerFault } from './report-worker-fault';
import { runResyncTurn } from './run-resync-turn';
import type { WorkerContext } from './types';

/**
 * The worker's one decision point for self-scheduled catch-ups, run on every connectivity proof:
 * drains the recovery avatar's reload-orphaned client-minted roots, resends whatever the submitter
 * held, delivers a stop raised offline, then — once the held tail is drained, so a resync never
 * reads a stale appended head — resyncs while no run is live. The recovery avatar comes from the
 * durable start intent first (recorded at the most recent boundary failure), else the reporting
 * tab's session avatar, else the last avatar a resync ran for; with none of the three, there is
 * nothing to catch up, and both the drain and the resync are skipped. An intent's avatar can be
 * stale — the account switched away from it while the intent was held — but the resync flow
 * discovers that itself from the service's own rejection and catches up the account's real active
 * avatar in the same call, so nothing needs deriving here. `claim` carries a reporting tab's
 * deliberate presence into the resync so it may take an active run's writer; the worker's own
 * triggers — a reconnect, a flush answer — never claim.
 */
export async function runReconnectRecovery(
  context: WorkerContext,
  signalAvatarID?: string,
  claim = false,
): Promise<void> {
  const heldIntent = await readPendingStartIntent();

  const avatarID =
    heldIntent?.avatarID ?? signalAvatarID ?? context.getResyncAvatarID() ?? undefined;

  // must precede flushHeld: an orphan's checkpoints would otherwise NOT_FOUND-discard on the
  // held flush before this ingests the root they chain onto
  if (avatarID !== undefined) {
    try {
      await drainStartRows(context, avatarID);
    } catch (error) {
      // a drain failure must not strand the held checkpoints and offline stop the steps below
      // deliver; the orphan rows persist for the next recovery to retry
      reportWorkerFault('reconnect', error);
    }
  }

  await context.getSubmitter().flushHeld();

  // A stop raised offline delivers here even when no resync will follow — the self-resync below
  // runs only while no run is live.
  await flushPendingStop(context);

  if (context.getActivity() === null && avatarID !== undefined) {
    await runResyncTurn(context, avatarID, claim);
  }
}
