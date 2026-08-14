import invariant from 'tiny-invariant';
import { buildCellNode } from './build-cell-node';
import { BIOME_TERRITORY_BLEND_BAND } from './consts';
import { getBiome } from './get-biome';
import { toHexPosition } from './to-hex-position';
import type { BiomeField, BiomeSample, Viewport } from './types';

export interface BuildBiomeFieldOptions {
  /**
   * Texels per axial cell unit. Higher resolves tighter territory borders; 1 degrades to one sample
   * per cell.
   */
  readonly resolution: number;
}

/**
 * Builds the biome texel grid a terrain-tint presentation samples. Ownership is node-anchored: each
 * texel belongs to its nearest jittered node and carries that node's biome, so a patch renders as
 * the union of its nodes' territories — borders weave between nodes, and a node never sits on a
 * border. Node jitter stays within its own cell, so the texel at a cell's own coordinate always
 * agrees with `getBiome` on that cell.
 *
 * `blendTs` carries cross-territory border proximity: 0 through a patch interior — including every
 * internal territory boundary between same-biome nodes — ramping to 1 where two differently-biomed
 * territories meet, over `BIOME_TERRITORY_BLEND_BAND` scene units. `neighbourBaseIDs` names the
 * biome across that border, the tint `blendT` blends toward.
 */
export function buildBiomeField(
  userSeed: number,
  viewport: Readonly<Viewport>,
  options: Readonly<BuildBiomeFieldOptions>,
): BiomeField {
  invariant(
    Number.isInteger(options.resolution) && options.resolution > 0,
    'resolution must be a positive integer',
  );

  const cols = (viewport.maxCX - viewport.minCX + 1) * options.resolution;
  const rows = (viewport.maxCY - viewport.minCY + 1) * options.resolution;

  const baseIDs = new Uint8Array(cols * rows);
  const neighbourBaseIDs = new Uint8Array(cols * rows);
  const modifierIDs = new Uint8Array(cols * rows);
  const blendTs = new Float32Array(cols * rows);
  const samples = new Map<string, BiomeSample>();

  const getSample = (cellX: number, cellY: number): BiomeSample => {
    const key = `${cellX}_${cellY}`;
    const cached = samples.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const sample = getBiome(userSeed, cellX, cellY);

    samples.set(key, sample);

    return sample;
  };

  const nodePositions = new Map<string, readonly [number, number]>();

  const getNodePosition = (cellX: number, cellY: number): readonly [number, number] => {
    const key = `${cellX}_${cellY}`;
    const cached = nodePositions.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const position = buildCellNode(userSeed, cellX, cellY).position;

    nodePositions.set(key, position);

    return position;
  };

  // Texels are laid out row-major over the viewport's cell box inflated by half a cell on each
  // side, the same convention `buildRevealDistanceField` uses: texel `(i, j)` samples axial
  // `(minCX - 0.5 + (i + 0.5) / resolution, minCY - 0.5 + (j + 0.5) / resolution)`, the mapping
  // a quad spanning that box with corner-anchored uvs interpolates.
  for (let j = 0; j < rows; j++) {
    const cy = viewport.minCY - 0.5 + (j + 0.5) / options.resolution;

    for (let i = 0; i < cols; i++) {
      const cx = viewport.minCX - 0.5 + (i + 0.5) / options.resolution;
      const index = j * cols + i;
      const territory = buildNearestNodeCells(getNodePosition, cx, cy);
      const sample = getSample(territory.nearestCellX, territory.nearestCellY);
      const neighbour = getSample(territory.secondCellX, territory.secondCellY);
      const gap = territory.secondDistance - territory.nearestDistance;

      baseIDs[index] = sample.baseID;
      neighbourBaseIDs[index] = neighbour.baseID;
      modifierIDs[index] = sample.modifierID;

      blendTs[index] =
        sample.baseID === neighbour.baseID ? 0 : 1 - Math.min(gap / BIOME_TERRITORY_BLEND_BAND, 1);
    }
  }

  return { baseIDs, blendTs, cols, modifierIDs, neighbourBaseIDs, rows };
}

interface NearestNodeCells {
  readonly nearestCellX: number;
  readonly nearestCellY: number;
  readonly nearestDistance: number;
  readonly secondCellX: number;
  readonly secondCellY: number;
  readonly secondDistance: number;
}

/**
 * Scans the 3×3 cell box around an axial position for the cells whose jittered nodes are nearest
 * and second-nearest in scene space, reading each candidate's position through the caller's lookup.
 * The box always contains both winners while the per-axis jitter bound stays below about 0.43: up
 * to there a position's nearest and second-nearest nodes are its own cell's and its hex
 * neighbours', all inside the box. Past that bound the second-nearest can fall outside the box and
 * biome borders would mis-render — the co-located wide-scan comparison test fails loudly first.
 */
function buildNearestNodeCells(
  getNodePosition: (cellX: number, cellY: number) => readonly [number, number],
  cx: number,
  cy: number,
): NearestNodeCells {
  const [sceneX, sceneY] = toHexPosition(cx, cy);
  const cellX = Math.round(cx);
  const cellY = Math.round(cy);
  let nearestDistance = Number.POSITIVE_INFINITY;
  let secondDistance = Number.POSITIVE_INFINITY;
  let nearestCellX = cellX;
  let nearestCellY = cellY;
  let secondCellX = cellX;
  let secondCellY = cellY;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const [nodeX, nodeY] = getNodePosition(cellX + dx, cellY + dy);
      const distance = Math.hypot(sceneX - nodeX, sceneY - nodeY);

      if (distance < nearestDistance) {
        secondDistance = nearestDistance;
        secondCellX = nearestCellX;
        secondCellY = nearestCellY;
        nearestDistance = distance;
        nearestCellX = cellX + dx;
        nearestCellY = cellY + dy;
      } else if (distance < secondDistance) {
        secondDistance = distance;
        secondCellX = cellX + dx;
        secondCellY = cellY + dy;
      }
    }
  }

  return {
    nearestCellX,
    nearestCellY,
    nearestDistance,
    secondCellX,
    secondCellY,
    secondDistance,
  };
}
