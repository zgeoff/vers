import { toNodeID } from './to-node-id';

const ID_PATTERN = /^-?\d+_-?\d+$/;

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
