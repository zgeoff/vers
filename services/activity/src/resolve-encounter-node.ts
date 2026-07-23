import { findCellCoord, getDifficulty } from '@vers/worldmap-core';

/**
 * Resolves the encounter params a `world_map_node` scope stamps on activity start. Undefined for any
 * other scope type, or a `world_map_node` scope whose id is not a valid cell coordinate. Difficulty
 * comes straight from the coordinate — no graph is loaded.
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
