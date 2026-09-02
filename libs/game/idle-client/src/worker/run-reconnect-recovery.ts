import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { drainActivityStarts } from './drain-activity-starts';
import { flushPendingStop } from './flush-pending-stop';
import { reportWorkerFault } from './report-worker-fault';
import { runResyncTurn } from './run-resync-turn';
import type { WorkerContext } from './types';

export async function runReconnectRecovery(
  context: WorkerContext,
  signalAvatarID?: string,
  claim = false,
): Promise<void> {
  const pendingAvatarID = await findPendingStartAvatarID();

  const avatarID = signalAvatarID ?? pendingAvatarID ?? context.getResyncAvatarID() ?? undefined;

  // must precede flushHeld: an orphan's checkpoints would otherwise NOT_FOUND-discard on the
  // held flush before this ingests the activity start they build onto
  if (avatarID !== undefined) {
    try {
      await drainActivityStarts(context, avatarID);
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

async function findPendingStartAvatarID(): Promise<string | undefined> {
  const rows = await readAllActivityStarts();

  return rows[0]?.avatarID;
}
