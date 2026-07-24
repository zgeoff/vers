import { toNodeID } from './to-node-id';

const ID_PATTERN = /^-?\d+_-?\d+$/;

/**
 * Recovers the integer cell coordinate a canonical id encodes, or undefined when the string is not a
 * well-formed canonical id. The total counterpart to `toCellCoord`, for callers holding untrusted
 * input such as a scope id off the wire. Accepts only the exact spelling `toNodeID` emits, so
 * leading zeros, a negative-zero coordinate, and out-of-safe-range magnitudes all miss — every node
 * has exactly one id.
 */
export function findCellCoord(id: string): [number, number] | undefined {
  if (!ID_PATTERN.test(id)) {
    return undefined;
  }

  const [cxRaw, cyRaw] = id.split('_');
  const cx = Number(cxRaw);
  const cy = Number(cyRaw);

  if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy) || toNodeID(cx, cy) !== id) {
    return undefined;
  }

  return [cx, cy];
}
