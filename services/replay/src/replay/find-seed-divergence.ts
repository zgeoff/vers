import type { CompareVerdict, ReplaySegment } from './types';

/**
 * Checks an activity's very first verified batch against the chain it belongs to: the activity's
 * stamped seed must equal the chain's genesis seed (a chain's first activity) or its verified
 * anchor (every later one), re-derived from the chain row rather than trusted from the activity
 * row. Already-verified activities (`verifiedHead > 0`) skip the check — it was settled on their
 * first pass. Undefined means no divergence found here; the caller proceeds to the trajectory
 * compare.
 */
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

/**
 * The chain's verified anchor is only a valid re-derivation source when this activity started
 * exactly where verification last left off — per-chain FIFO guarantees that alignment for an
 * honest activity, so a mismatch here is itself grounds for divergence.
 */
function findExpectedContinuationSeed(segment: Readonly<ReplaySegment>): string | undefined {
  if (segment.chain.verifiedChainIndex !== segment.activity.startChainIndex) {
    return undefined;
  }

  return segment.chain.verifiedNextSeed;
}
