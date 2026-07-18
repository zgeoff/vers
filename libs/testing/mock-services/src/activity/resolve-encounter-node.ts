import { worldMapNodes } from '@vers/data';
import { decompressWorldGraph } from '@vers/worldmap-core';

const worldGraph = decompressWorldGraph(worldMapNodes);

/**
 * Mirrors the real activity service's node resolution: undefined for any scope type other than
 * `world_map_node`, or a `world_map_node` scope whose id the current map doesn't carry.
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
