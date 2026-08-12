import { buildBiomeSample } from './build-biome-sample';
import type { BiomeField, Viewport } from './types';

export interface BuildBiomeFieldOptions {
  /**
   * Texels per axial cell unit. Higher resolves rounder patch borders; 1 degrades to one sample per
   * cell.
   */
  readonly resolution: number;
}

/**
 * Builds the biome texel grid a terrain-tint presentation samples, one `buildBiomeSample` draw per
 * texel. Texels are laid out row-major over the viewport's cell box inflated by half a cell on each
 * side, the same convention `buildRevealDistanceField` uses: texel `(i, j)` samples axial `(minCX -
 * 0.5 + (i + 0.5) / resolution, minCY - 0.5 + (j + 0.5) / resolution)`, the mapping a quad spanning
 * that box with corner-anchored uvs interpolates. At `resolution` 1 a texel center lands exactly on
 * every integer cell coordinate, so the field agrees with `getBiome` called directly on that cell —
 * both draw from the same pure function of `(userSeed, cx, cy)`, so no chunk or sampling order ever
 * moves a shared cell's result.
 */
export function buildBiomeField(
  userSeed: number,
  viewport: Readonly<Viewport>,
  options: Readonly<BuildBiomeFieldOptions>,
): BiomeField {
  const cols = (viewport.maxCX - viewport.minCX + 1) * options.resolution;
  const rows = (viewport.maxCY - viewport.minCY + 1) * options.resolution;

  const baseIDs = new Uint8Array(cols * rows);
  const neighbourBaseIDs = new Uint8Array(cols * rows);
  const modifierIDs = new Uint8Array(cols * rows);
  const blendTs = new Float32Array(cols * rows);

  for (let j = 0; j < rows; j++) {
    const cy = viewport.minCY - 0.5 + (j + 0.5) / options.resolution;

    for (let i = 0; i < cols; i++) {
      const cx = viewport.minCX - 0.5 + (i + 0.5) / options.resolution;
      const sample = buildBiomeSample(userSeed, cx, cy);
      const index = j * cols + i;

      baseIDs[index] = sample.baseID;
      neighbourBaseIDs[index] = sample.neighbourBaseID;
      modifierIDs[index] = sample.modifierID;
      blendTs[index] = sample.blendT;
    }
  }

  return { baseIDs, blendTs, cols, modifierIDs, neighbourBaseIDs, rows };
}
