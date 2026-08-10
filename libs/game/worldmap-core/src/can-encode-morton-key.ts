import { WORLD_COORD_MAX, WORLD_COORD_MIN } from './consts';

/**
 * Whether a coordinate packs into a Morton key: both axes are integers inside the packable range.
 * Callers holding coordinates from an unbounded source — a stored grant key, a disc that runs off
 * the edge of the world — filter through this before packing, since the encoder treats an
 * unpackable coordinate as a caller bug.
 */
export function canEncodeMortonKey(coord: readonly [number, number]): boolean {
  return coord.every(
    (axis) => Number.isInteger(axis) && axis >= WORLD_COORD_MIN && axis <= WORLD_COORD_MAX,
  );
}
