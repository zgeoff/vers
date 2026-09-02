import { findCellCoord, getDifficulty } from '@vers/worldmap-core';

export function resolveEncounterNode(
  scopeType: string,
  scopeID: string,
): { coord: [number, number]; difficulty: number } | undefined {
  if (scopeType !== 'world_map_node') {
    return undefined;
  }

  const coord = findCellCoord(scopeID);

  return coord === undefined ? undefined : { coord, difficulty: getDifficulty(coord[0], coord[1]) };
}
