import type { ActivityData } from '@vers/contract-activity';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readLastStartedActivity } from '../submission/read-last-started-activity';
import { removeActivityStart } from '../submission/remove-activity-start';
import { removeLastStartedActivity } from '../submission/remove-last-started-activity';
import { removeQueuedCheckpoints } from '../submission/remove-queued-checkpoints';
import { writeLastStartedActivity } from '../submission/write-last-started-activity';
import { ingestAndBroadcastActivityStart } from './ingest-and-broadcast-activity-start';
import type { WorkerContext } from './types';

/**
 * Drains this avatar's reload-orphaned client-minted activity starts — an activity start whose live
 * simulation was lost to a worker reload, so nothing is registered to drive its checkpoint flush.
 * Delivers them in predecessor order, so the server always sees an activity start's predecessor
 * before the activity start itself and an absent predecessor means the predecessor was refused,
 * never merely late. Per row the ingest outcome decides the action: `ingested` announces the
 * activity to connected tabs and registers it so its durably queued checkpoints seed and flush; `deferred` leaves the row for a later
 * recovery; `rejected` drops the row and, because a successor built on a refused activity start can
 * never verify, its whole dependent subtree. A row for a different avatar this device also owns is
 * left untouched — it drains on that avatar's own recovery, since minting its activity start needs
 * it as the active avatar.
 */
export async function drainActivityStarts(context: WorkerContext, avatarID: string): Promise<void> {
  const allRows = await readAllActivityStarts();

  const rows = allRows.filter((row) => row.avatarID === avatarID);
  const ordered = sortByPredecessor(rows);

  const dropped = new Set<string>();

  for (const row of ordered) {
    const predecessorID = row.predecessorActivityID;

    if (predecessorID !== null && dropped.has(predecessorID)) {
      await removeUnverifiableStartRow(row.id);

      dropped.add(row.id);
      continue;
    }

    const outcome = await ingestAndBroadcastActivityStart(context, row.id);

    if (outcome === 'rejected') {
      // ingest already removed the pending row; clear the queued checkpoints that would
      // otherwise build onto an activity start that will never exist, and cascade to its
      // successors
      await removeQueuedCheckpoints(row.id);

      dropped.add(row.id);
      continue;
    }

    if (outcome !== 'ingested') {
      continue;
    }

    // repair the durable predecessor a reload orphaned: record this drained activity start as the
    // avatar's last-started, so the next start stamps it rather than a stale or absent predecessor
    await writeLastStartedActivity({ avatarID: row.avatarID, lastActivityID: row.id });

    await context.getSubmitter().registerActivity({
      activityID: row.id,
      appendedHead: 0,
      avatarID: row.avatarID,
      lastHash: row.startHash,
      previousNextSeed: row.seed,
      scopeID: row.scopeID,
      startChainIndex: row.startChainIndex,
    });
  }

  await removeDroppedLastStarted(avatarID, dropped);
}

/**
 * Orders rows so a row whose predecessor is also in the set follows it. A cycle — only a malformed
 * or malicious set produces one — is broken by the visited guard, leaving its members in an
 * arbitrary order among themselves.
 */
function sortByPredecessor(rows: ReadonlyArray<ActivityData>): Array<ActivityData> {
  const byID = new Map(rows.map((row) => [row.id, row]));
  const visited = new Set<string>();

  const ordered: Array<ActivityData> = [];

  const collectInOrder = (row: Readonly<ActivityData>): void => {
    if (visited.has(row.id)) {
      return;
    }

    visited.add(row.id);

    const predecessor =
      row.predecessorActivityID === null ? undefined : byID.get(row.predecessorActivityID);

    if (predecessor !== undefined) {
      collectInOrder(predecessor);
    }

    ordered.push(row);
  };

  for (const row of rows) {
    collectInOrder(row);
  }

  return ordered;
}

/**
 * Removes an undelivered successor of a refused activity start — its pending row and queued
 * checkpoints — since it can never verify against a predecessor that does not exist.
 */
async function removeUnverifiableStartRow(activityID: string): Promise<void> {
  await removeActivityStart(activityID);
  await removeQueuedCheckpoints(activityID);
}

/**
 * Removes the avatar's last-started record when it names a dropped activity start, so a later start
 * stamps no predecessor rather than one that will never exist.
 */
async function removeDroppedLastStarted(
  avatarID: string,
  dropped: ReadonlySet<string>,
): Promise<void> {
  const lastStarted = await readLastStartedActivity(avatarID);

  if (lastStarted !== undefined && dropped.has(lastStarted.lastActivityID)) {
    await removeLastStartedActivity(avatarID);
  }
}
