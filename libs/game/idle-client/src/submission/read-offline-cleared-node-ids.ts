import { ActivityCheckpointType } from '@vers/idle-core';
import { readAllActivityStarts } from './read-all-activity-starts';
import { readQueuedCheckpoints } from './read-queued-checkpoints';

// widened to `string` so the comparison below reads against a checkpoint payload's untyped
// `type` field without the compiler treating it as a comparison across unrelated enum types
const COMPLETED_CHECKPOINT_TYPE: string = ActivityCheckpointType.Completed;

export async function readOfflineClearedNodeIDs(avatarID: string): Promise<ReadonlySet<string>> {
  const rows = await readAllActivityStarts();

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
