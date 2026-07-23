import type { CanonicalID } from './types';

/**
 * Encodes a cell coordinate as its canonical node id, `"cx_cy"`. Reversed by `toCellCoord`. The
 * underscore separator keeps the id within the activity scope-identifier character set, so a node id
 * is a valid activity scope with no escaping.
 */
export function toNodeID(cx: number, cy: number): CanonicalID {
  return `${cx}_${cy}`;
}
