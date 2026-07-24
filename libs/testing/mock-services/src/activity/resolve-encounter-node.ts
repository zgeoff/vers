import { findCellCoord, getDifficulty } from '@vers/worldmap-core';

/**
 * Mirrors the real activity service's node resolution: undefined for any scope type other than
 * `world_map_node`, or a `world_map_node` scope whose id is not a valid cell coordinate.
 */
export function resolveEncounterNode(
  scopeType: string,
  scopeID: string,
): { difficulty: number } | undefined {
  if (scopeType !== 'world_map_node') {
    return undefined;
  }

  const coord = findCellCoord(scopeID);

  return coord === undefined ? undefined : { difficulty: getDifficulty(coord[0], coord[1]) };
}
