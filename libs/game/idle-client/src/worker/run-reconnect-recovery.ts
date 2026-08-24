import type { ActivityData } from '@vers/contract-activity';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { drainActivityStarts } from './drain-activity-starts';
import { flushPendingStop } from './flush-pending-stop';
import { reportWorkerFault } from './report-worker-fault';
import { runResyncTurn } from './run-resync-turn';
import type { WorkerContext } from './types';

/**
 * The worker's one decision point for self-scheduled catch-ups, run on every connectivity proof:
 * drains the recovery avatar's reload-orphaned client-minted activity starts, resends whatever the
 * submitter held, delivers a stop raised offline, then — once the held tail is drained, so a resync
 * never reads a stale appended head — resyncs while no run is live. The recovery avatar comes from
 * the reporting tab's session avatar first — the account's own active choice, which outranks a
 * local row the account may have moved on from — else this device's newest undelivered activity
 * start, else the last avatar a resync ran for; with none of the three, there is nothing to catch
 * up, and both the drain and the resync are skipped. `claim` carries a reporting tab's
 * deliberate presence into the resync so it may take an active run's writer; the worker's own
 * triggers — a reconnect, a flush answer — never claim.
 */
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

/**
 * The avatar of the newest undelivered activity start this device holds, or undefined when it holds
 * none. The newest row names the avatar this device most recently played, which is the one whose
 * work a recovery catches up; that avatar's older rows drain in the same pass.
 */
async function findPendingStartAvatarID(): Promise<string | undefined> {
  const rows = await readAllActivityStarts();

  const newest = rows.reduce<ActivityData | undefined>(
    (latest, row) => (latest === undefined || row.createdAt > latest.createdAt ? row : latest),
    undefined,
  );

  return newest?.avatarID;
}
