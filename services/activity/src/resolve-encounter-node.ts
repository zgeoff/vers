import { worldMapNodes } from '@vers/data';
import { decompressWorldGraph } from '@vers/worldmap-core';

const worldGraph = decompressWorldGraph(worldMapNodes);

/**
 * Resolves the encounter params a `world_map_node` scope stamps on activity start. Undefined for
 * any other scope type, or a `world_map_node` scope whose id the current map doesn't carry.
 */
export function resolveEncounterNode(
  scopeType: string,
  scopeID: string,
): { difficulty: number } | undefined {
  if (scopeType !== 'world_map_node') {
    return undefined;
  }

  const node = worldGraph.nodes[scopeID];

  return node === undefined ? undefined : { difficulty: node.difficulty };
}
