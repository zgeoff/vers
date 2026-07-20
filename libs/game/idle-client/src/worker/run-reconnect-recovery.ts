import { readPendingStartIntent } from '../submission/read-pending-start-intent';
import { flushPendingStop } from './flush-pending-stop';
import { runResyncTurn } from './run-resync-turn';
import type { WorkerContext } from './types';

/**
 * The worker's one decision point for self-scheduled catch-ups, run on every connectivity proof:
 * resends whatever the submitter held, delivers a stop raised offline, then — once the held tail
 * is drained, so a resync never reads a stale appended head — resyncs while no run is live. The
 * avatar comes from the durable start intent first (recorded at the most recent boundary failure,
 * so it is always the freshest signal), else the reporting tab's session avatar, else the last
 * avatar a resync ran for; with none of the three, there is nothing to catch up. `claim` carries
 * a reporting tab's deliberate presence into the resync so it may take an active run's writer;
 * the worker's own triggers — a reconnect, a flush answer — never claim.
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

  const avatarID = heldIntent?.avatarID ?? signalAvatarID ?? context.getResyncAvatarID() ?? null;

  if (context.getActivity() === null && avatarID !== null) {
    await runResyncTurn(context, avatarID, claim);
  }
}
