import { NodeSeedSchema } from '@vers/contract-activity';
import { NODE_SEEDS_STORE_NAME } from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import type { NodeSeed } from './types';

/**
 * A world-map node's cached start inputs, the avatar and node id it was read for dropped since the
 * caller already holds both.
 */
export type CachedNodeSeed = Omit<NodeSeed, 'avatarID' | 'nodeID'>;

/**
 * Reads an avatar's cached start inputs — genesis seed, encounter, and content version — for a
 * world-map node, `undefined` when this device has never revealed that node for that avatar. A
 * stored row that fails the contract schema is self-healing: the row is deleted so the next reveal
 * repopulates it, rather than serving a value that could never have come from a real reveal.
 */
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
    head: result.data.head,
  };
}
