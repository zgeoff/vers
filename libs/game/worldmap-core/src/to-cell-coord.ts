import invariant from 'tiny-invariant';

const ID_PATTERN = /^-?\d+_-?\d+$/;

/**
 * Reverses `toNodeID`, recovering the integer cell coordinate a canonical id encodes. Throws on any
 * string that is not a well-formed id — a broken invariant, never ordinary input.
 */
export function toCellCoord(id: string): [number, number] {
  invariant(ID_PATTERN.test(id), `malformed node id: ${id}`);

  const [cx, cy] = id.split('_');

  return [Number(cx), Number(cy)];
}
