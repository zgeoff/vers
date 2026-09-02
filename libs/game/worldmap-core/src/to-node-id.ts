import type { CanonicalID } from './types';

export function toNodeID(cx: number, cy: number): CanonicalID {
  return `${cx}_${cy}`;
}
