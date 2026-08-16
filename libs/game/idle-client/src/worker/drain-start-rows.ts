import { ingestStartRow } from '../submission/ingest-start-row';
import { readAllStartRows } from '../submission/read-all-start-rows';
import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
import { removeQueuedCheckpoints } from '../submission/remove-queued-checkpoints';
import type { WorkerContext } from './types';

/**
 * Drains this avatar's reload-orphaned client-minted roots — a root whose live simulation was
 * lost to a worker reload, so nothing is registered to drive its checkpoint flush. Per pending row
 * for the avatar, the ingest outcome decides the action: `ingested` registers the activity so its
 * durably queued checkpoints seed and flush; `deferred` leaves the row for a later recovery;
 * `rejected` and `absent` need nothing further, the row already gone. A row for a different avatar
 * this device also owns is left untouched — it drains on that avatar's own recovery, since minting
 * its root needs it as the active avatar.
 */
export async function drainStartRows(context: WorkerContext, avatarID: string): Promise<void> {
  const rows = await readAllStartRows();

  for (const row of rows) {
    if (row.avatarID !== avatarID) {
      continue;
    }

    const outcome = await ingestStartRow(context.getClient(), row.id);

    if (outcome === 'rejected') {
      // the server refused the root; its durably queued checkpoints can never chain onto a row
      // that will not exist, so drop them here as the flush path drops a refused stream's
      await removeQueuedCheckpoints(row.id);

      // a held start intent for the refused root would retry forever against a predecessor that
      // never lands, so drop it too
      await removePendingStartIntent(row.id);

      continue;
    }

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
