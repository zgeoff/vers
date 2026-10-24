import type { ReplaySegment } from '../replay/types';

export function buildCompareContext(segment: Readonly<ReplaySegment>) {
  return {
    prevHash: segment.prevHash,
    seed: segment.seed,
    startChainIndex: segment.activity.startChainIndex,
  };
}
