import { WORLD_COORD_MAX, WORLD_COORD_MIN } from './consts';

export function canEncodeMortonKey(coord: readonly [number, number]): boolean {
  return coord.every(
    (axis) => Number.isInteger(axis) && axis >= WORLD_COORD_MIN && axis <= WORLD_COORD_MAX,
  );
}
