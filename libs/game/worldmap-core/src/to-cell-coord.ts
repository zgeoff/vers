import invariant from 'tiny-invariant';
import { findCellCoord } from './find-cell-coord';

export function toCellCoord(id: string): [number, number] {
  const coord = findCellCoord(id);

  invariant(coord, `malformed node id: ${id}`);

  return coord;
}
