import type { ActivityData } from '@vers/contract-activity';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readLastStartedActivity } from '../submission/read-last-started-activity';
import { removeActivityStart } from '../submission/remove-activity-start';
import { removeLastStartedActivity } from '../submission/remove-last-started-activity';
import { removeQueuedCheckpoints } from '../submission/remove-queued-checkpoints';
import { writeLastStartedActivity } from '../submission/write-last-started-activity';
import { ingestAndBroadcastActivityStart } from './ingest-and-broadcast-activity-start';
import type { WorkerContext } from './types';

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

    // the service never answered: every later row would fail the same way, so the drain marks the
    // connection down and leaves the rest for the next recovery
    if (outcome === 'undelivered') {
      context.updateConnectivity(false);
      break;
    }

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

async function removeUnverifiableStartRow(activityID: string): Promise<void> {
  await removeActivityStart(activityID);
  await removeQueuedCheckpoints(activityID);
}

async function removeDroppedLastStarted(
  avatarID: string,
  dropped: ReadonlySet<string>,
): Promise<void> {
  const lastStarted = await readLastStartedActivity(avatarID);

  if (lastStarted !== undefined && dropped.has(lastStarted.lastActivityID)) {
    await removeLastStartedActivity(avatarID);
  }
}
