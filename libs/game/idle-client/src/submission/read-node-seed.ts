import { NodeSeedSchema } from '@vers/contract-activity';
import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { NodeSeed } from './types';

export type CachedNodeSeed = Omit<NodeSeed, 'avatarID' | 'nodeID'>;

export async function readNodeSeed(
  avatarID: string,
  nodeID: string,
): Promise<CachedNodeSeed | undefined> {
  const db = await resolveCheckpointQueueDB();

  // Read, validate, and delete a mismatched row inside one readwrite transaction so a concurrent
  // reveal that repopulates the row can't have its fresh value deleted between a separate read and
  // delete.
  const tx = db.transaction(NODE_SEEDS_STORE_NAME, 'readwrite');

  const record = await tx.store.get([avatarID, nodeID]);

  if (record === undefined) {
    await tx.done;

    return undefined;
  }

  // A cache-store read resolves a schema mismatch as a miss rather than throwing: the row is
  // rebuildable from the next reveal, unlike a server jsonb/text column an untyped-boundary
  // `.parse` guards.
  const result = NodeSeedSchema.safeParse(record);

  if (!result.success) {
    await tx.store.delete([avatarID, nodeID]);

    await tx.done;

    return undefined;
  }

  await tx.done;

  return {
    contentVersion: result.data.contentVersion,
    encounterNode: result.data.encounterNode,
    genesisSeed: result.data.genesisSeed,
    anchor: result.data.anchor,
  };
}
