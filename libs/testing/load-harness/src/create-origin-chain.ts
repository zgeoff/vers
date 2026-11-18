import { ORIGIN_CELL, toNodeID } from '@vers/worldmap-core';
import invariant from 'tiny-invariant';
import type { PlayerChain, PlayerClient } from './types';

const WORLD_MAP_SCOPE_TYPE = 'world_map_node';

export async function createOriginChain(
  client: PlayerClient,
  avatarID: string,
): Promise<PlayerChain> {
  const originID = toNodeID(ORIGIN_CELL[0], ORIGIN_CELL[1]);

  const revealed = await client.revealNodes({ avatarID, nodeIDs: [originID] });

  const origin = revealed.nodes.find((node) => node.nodeID === originID);

  invariant(origin !== undefined, 'the origin is always inside the revealed region');

  return {
    anchor: origin.anchor,
    contentVersion: origin.contentVersion,
    encounterNode: origin.encounterNode,
    keyVersion: revealed.keyVersion,
    scopeID: originID,
    scopeType: WORLD_MAP_SCOPE_TYPE,
  };
}
