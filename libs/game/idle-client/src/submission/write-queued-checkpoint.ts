import type { CheckpointBatchEntry } from '@vers/contract-activity';
import { CHECKPOINT_QUEUE_STORE_NAME, NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import { runAtomicWrites } from './run-atomic-writes';
import type { NodeAnchorAdvance } from './types';

export async function writeQueuedCheckpoint(
  activityID: string,
  entry: Readonly<CheckpointBatchEntry>,
  advance?: Readonly<NodeAnchorAdvance>,
): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const tx = db.transaction([CHECKPOINT_QUEUE_STORE_NAME, NODE_SEEDS_STORE_NAME], 'readwrite');
  const seeds = tx.objectStore(NODE_SEEDS_STORE_NAME);

  const cached =
    advance === undefined ? undefined : await seeds.get([advance.avatarID, advance.nodeID]);

  const writes: Array<() => Promise<unknown>> = [
    () => tx.objectStore(CHECKPOINT_QUEUE_STORE_NAME).put({ ...entry, activityID }),
  ];

  if (
    advance !== undefined &&
    cached !== undefined &&
    cached.anchor.chainIndex <= advance.anchor.chainIndex
  ) {
    writes.push(() => seeds.put({ ...cached, anchor: advance.anchor }));
  }

  await runAtomicWrites(tx, writes);
}
