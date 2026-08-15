import { ingestStartRow } from '../submission/ingest-start-row';
import { readAllStartRows } from '../submission/read-all-start-rows';
import type { WorkerContext } from './types';

/**
 * Drains this avatar's reload-orphaned client-minted roots — a root whose live simulation was
 * lost to a worker reload, so nothing is registered to drive its checkpoint flush. Each pending
 * row for the avatar is ingested in turn, sequentially and awaited, one activity's ingest failure
 * never blocking the next: an `ingested` outcome registers the activity so its durably queued
 * checkpoints seed and flush; `deferred` leaves the row for a later recovery; `rejected` and
 * `absent` need nothing further, the row already gone. A row for a different avatar this device
 * also owns is left untouched — it drains on that avatar's own recovery, since minting its root
 * needs it as the active avatar.
 */
export async function drainStartRows(context: WorkerContext, avatarID: string): Promise<void> {
  const rows = await readAllStartRows();

  for (const row of rows) {
    if (row.avatarID !== avatarID) {
      continue;
    }

    const outcome = await ingestStartRow(context.getClient(), row.id);

    if (outcome !== 'ingested') {
      continue;
    }

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
}
