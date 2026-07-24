import invariant from 'tiny-invariant';
import { findCellCoord } from './find-cell-coord';

/**
 * Reverses `toNodeID`, recovering the integer cell coordinate a canonical id encodes. Throws on any
 * string that is not a well-formed id — a broken invariant, never ordinary input; callers holding
 * untrusted input reach for `findCellCoord` instead.
 */
export function toCellCoord(id: string): [number, number] {
  const coord = findCellCoord(id);

  invariant(coord, `malformed node id: ${id}`);

  return coord;
}
