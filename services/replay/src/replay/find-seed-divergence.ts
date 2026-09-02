import type { CompareVerdict, ReplaySegment } from './types';

export function findSeedDivergence(
  segment: Readonly<ReplaySegment>,
): Extract<CompareVerdict, { kind: 'divergence' }> | undefined {
  if (segment.verifiedHead !== 0) {
    return undefined;
  }

  const expectedSeed =
    segment.activity.startChainIndex === 0
      ? segment.chain.genesisSeed
      : findExpectedContinuationSeed(segment);

  if (expectedSeed === undefined || expectedSeed !== segment.activity.seed) {
    return { kind: 'divergence', reason: 'seed-mismatch', version: 1 };
  }

  return undefined;
}

function findExpectedContinuationSeed(segment: Readonly<ReplaySegment>): string | undefined {
  if (segment.chain.verifiedChainIndex !== segment.activity.startChainIndex) {
    return undefined;
  }

  return segment.chain.verifiedNextSeed;
}
