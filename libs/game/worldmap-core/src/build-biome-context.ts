import type { BiomeContext } from './types';

/**
 * Builds an empty per-build memoization context for `buildBiomeSample`: a fresh `Map` pair scoped
 * to one field build (or one `getBiome` call), so a coarse cell several texels revisit resolves its
 * Worley feature point and roster draw once instead of on every visit.
 */
export function buildBiomeContext(userSeed: number): BiomeContext {
  return { featurePoints: new Map(), rosterIDs: new Map(), userSeed };
}
