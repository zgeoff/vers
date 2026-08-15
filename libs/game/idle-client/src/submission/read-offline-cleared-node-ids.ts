import { ActivityCheckpointType } from '@vers/idle-core';
import { readAllStartRows } from './read-all-start-rows';
import { readQueuedCheckpoints } from './read-queued-checkpoints';

// widened to `string` so the comparison below reads against a checkpoint payload's untyped
// `type` field without the compiler treating it as a comparison across unrelated enum types
const COMPLETED_CHECKPOINT_TYPE: string = ActivityCheckpointType.Completed;

/**
 * The avatar's world-map nodes cleared offline but not yet server-verified, derived from the
 * durable offline outbox: a pending root scoped to a `world_map_node` whose queued checkpoints
 * hold a completed terminal. Empty once nothing is pending, so the call stays cheap on the common
 * online path, and it shrinks on its own as ingest drains the outbox — a verified clear needs no
 * removal here, only a re-derive.
 */
export async function readOfflineClearedNodeIDs(avatarID: string): Promise<ReadonlySet<string>> {
  const rows = await readAllStartRows();

  const clearedNodeIDs = new Set<string>();

  for (const row of rows) {
    if (row.avatarID !== avatarID || row.scopeType !== 'world_map_node') {
      continue;
    }

    const checkpoints = await readQueuedCheckpoints(row.id);

    // a failed terminal clears nothing; only a completed terminal opens the node's neighbours
    if (checkpoints.some((checkpoint) => checkpoint.payload.type === COMPLETED_CHECKPOINT_TYPE)) {
      clearedNodeIDs.add(row.scopeID);
    }
  }

  return clearedNodeIDs;
}
