import { buildBiomeContext } from './build-biome-context';
import { buildBiomeSample } from './build-biome-sample';
import type { BiomeSample } from './types';

/**
 * Samples the terrain plane at a position: a base biome, the neighbour it blends toward near a
 * patch border, a border-proximity `blendT`, and an independent modifier layer — a low-frequency
 * hybrid Worley/value-noise field, `f(userSeed, cx, cy)` alone. Public geometry: every client
 * derives the identical sample from the same seed and position, and `cx`/`cy` may be any real
 * number, not only an integer cell coordinate, so a texel field can sample between cell centers.
 *
 * A hidden per-node reward that clusters by biome is permanently forbidden — it would turn
 * client-visible terrain into a treasure map for sealed loot, the exact sniping fog exists to deny.
 * Biome may only ever touch reward through a public, biome-uniform function of the public biome id,
 * constant across every node the id covers; it may never ride hidden per-node variance.
 *
 * A one-off wrapper over `buildBiomeSample`: this call builds a fresh, single-sample context, so
 * repeat calls never share a coarse-cell cache with each other. `buildBiomeField` drives
 * `buildBiomeSample` directly with one context reused across its whole texel grid instead.
 */
export function getBiome(userSeed: number, cx: number, cy: number): BiomeSample {
  return buildBiomeSample(buildBiomeContext(userSeed), cx, cy);
}
