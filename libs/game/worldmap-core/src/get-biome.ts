import invariant from 'tiny-invariant';
import { HASH_CHANNEL, buildCoordHashUnit } from './build-coord-hash';
import { buildValueNoise } from './build-value-noise';
import {
  BIOME_BLEND_BAND,
  BIOME_EDGE_WOBBLE_AMPLITUDE,
  BIOME_EDGE_WOBBLE_FREQUENCY,
  BIOME_PATCH_SIZE,
  BIOME_ROSTER,
  HEX_SIZE,
  MODIFIER_PATCH_SIZE,
  MODIFIER_ROSTER,
  ORIGIN_CELL,
} from './consts';
import { getHexDistance } from './get-hex-distance';
import { toHexPosition } from './to-hex-position';
import type { BiomeRosterEntry, BiomeSample } from './types';

/**
 * Samples the terrain plane at a position: a base biome, the neighbour it blends toward near a
 * patch border, a border-proximity `blendT`, and an independent modifier layer — a low-frequency
 * hybrid Worley/value-noise field, `f(userSeed, cx, cy)` alone. Public geometry: every client
 * derives the identical sample from the same seed and position, and `cx`/`cy` may be any real
 * number, not only an integer cell coordinate, so a texel field can sample between cell centers.
 *
 * The base layer reads its nearest and second-nearest feature point for `blendT` and
 * `neighbourBaseID`; the modifier layer's border blend is never read, so it reads only its nearest.
 *
 * A hidden per-node reward that clusters by biome is permanently forbidden — it would turn
 * client-visible terrain into a treasure map for sealed loot, the exact sniping fog exists to deny.
 * Biome may only ever touch reward through a public, biome-uniform function of the public biome id,
 * constant across every node the id covers; it may never ride hidden per-node variance.
 */
export function getBiome(userSeed: number, cx: number, cy: number): BiomeSample {
  const [hexX, hexY] = toHexPosition(cx, cy);
  const wobbleSampleX = hexX * BIOME_EDGE_WOBBLE_FREQUENCY;
  const wobbleSampleY = hexY * BIOME_EDGE_WOBBLE_FREQUENCY;
  const wobbleX = buildValueNoise(userSeed, wobbleSampleX, wobbleSampleY, HASH_CHANNEL.wobbleX);
  const wobbleY = buildValueNoise(userSeed, wobbleSampleX, wobbleSampleY, HASH_CHANNEL.wobbleY);
  const warpedX = hexX + BIOME_EDGE_WOBBLE_AMPLITUDE * (wobbleX - 0.5);
  const warpedY = hexY + BIOME_EDGE_WOBBLE_AMPLITUDE * (wobbleY - 0.5);

  const base = buildNearestFeaturePoints(
    userSeed,
    warpedX,
    warpedY,
    BIOME_PATCH_SIZE,
    HASH_CHANNEL.worleyFeatureX,
    HASH_CHANNEL.worleyFeatureY,
  );

  const modifier = buildNearestFeaturePoints(
    userSeed,
    warpedX,
    warpedY,
    MODIFIER_PATCH_SIZE,
    HASH_CHANNEL.modifierFeatureX,
    HASH_CHANNEL.modifierFeatureY,
  );

  const baseID = pickRosterID(
    userSeed,
    base.nearestCellX,
    base.nearestCellY,
    BIOME_PATCH_SIZE,
    HASH_CHANNEL.biomeDraw,
    BIOME_ROSTER,
  );

  const neighbourBaseID = pickRosterID(
    userSeed,
    base.secondCellX,
    base.secondCellY,
    BIOME_PATCH_SIZE,
    HASH_CHANNEL.biomeDraw,
    BIOME_ROSTER,
  );

  const modifierID = pickRosterID(
    userSeed,
    modifier.nearestCellX,
    modifier.nearestCellY,
    MODIFIER_PATCH_SIZE,
    HASH_CHANNEL.modifierDraw,
    MODIFIER_ROSTER,
  );

  return {
    baseID,
    blendT: getBorderBlend(base.nearestDistance, base.secondDistance),
    modifierID,
    neighbourBaseID,
  };
}

interface NearestFeaturePoints {
  readonly nearestCellX: number;
  readonly nearestCellY: number;
  readonly nearestDistance: number;
  readonly secondCellX: number;
  readonly secondCellY: number;
  readonly secondDistance: number;
}

/**
 * Scatters one jittered feature point per coarse cell of `patchSize` and scans the 5×5
 * neighbourhood around `(x, y)` for the nearest and second-nearest, the Worley step behind the
 * border blend. Feature points jitter anywhere inside their cell, so a sample near a cell corner
 * can sit closer to a feature two rings out than to every feature in the 3×3 window. 5×5 is always
 * enough: the sample's own cell and its corner-adjacent cell each hold a candidate within √2 patch
 * units, while every cell three or more rings out lies at least 2 patch units away, so both winners
 * fall inside the window. Candidate coordinates and feature points stay plain numbers throughout
 * the scan — nothing is allocated per candidate.
 */
function buildNearestFeaturePoints(
  userSeed: number,
  x: number,
  y: number,
  patchSize: number,
  featureXChannel: number,
  featureYChannel: number,
): NearestFeaturePoints {
  const baseCellX = Math.floor(x / patchSize);
  const baseCellY = Math.floor(y / patchSize);
  let nearestDistance = Number.POSITIVE_INFINITY;
  let secondDistance = Number.POSITIVE_INFINITY;
  let nearestCellX = baseCellX;
  let nearestCellY = baseCellY;
  let secondCellX = baseCellX;
  let secondCellY = baseCellY;

  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const cellX = baseCellX + dx;
      const cellY = baseCellY + dy;
      const jitterX = buildCoordHashUnit(userSeed, cellX, cellY, featureXChannel);
      const jitterY = buildCoordHashUnit(userSeed, cellX, cellY, featureYChannel);
      const featureX = (cellX + jitterX) * patchSize;
      const featureY = (cellY + jitterY) * patchSize;
      const distance = Math.hypot(x - featureX, y - featureY);

      if (distance < nearestDistance) {
        secondDistance = nearestDistance;
        secondCellX = nearestCellX;
        secondCellY = nearestCellY;
        nearestDistance = distance;
        nearestCellX = cellX;
        nearestCellY = cellY;
      } else if (distance < secondDistance) {
        secondDistance = distance;
        secondCellX = cellX;
        secondCellY = cellY;
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

/**
 * Selects a coarse cell's roster id: each entry's weight curve is evaluated at the cell's hex
 * distance from the origin exactly once, and a single hash draw keyed by the cell's own coordinates
 * picks proportionally among the resulting weights. Every side computing a coarse cell's biome reads
 * this same draw, so a patch's assignment never depends on which neighbouring cell asked first.
 */
function pickRosterID(
  userSeed: number,
  cellX: number,
  cellY: number,
  patchSize: number,
  drawChannel: number,
  roster: ReadonlyArray<BiomeRosterEntry>,
): number {
  invariant(roster.length > 0, 'a biome roster must carry at least one alternative');

  const anchor = toAxialPosition((cellX + 0.5) * patchSize, (cellY + 0.5) * patchSize);
  const distance = getHexDistance(anchor, ORIGIN_CELL);
  const weights = roster.map((entry) => getWeightAtDistance(entry.weights, distance));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  invariant(total > 0, 'a biome roster must carry positive weight at every distance');

  const draw = buildCoordHashUnit(userSeed, cellX, cellY, drawChannel) * total;
  let cumulative = 0;

  for (const [index, entry] of roster.entries()) {
    cumulative += weights[index] ?? 0;

    if (draw < cumulative) {
      return entry.id;
    }
  }

  const last = roster.at(-1);

  invariant(last, 'a non-empty roster always has a last entry');

  return last.id;
}

const SQRT_3 = Math.sqrt(3);

/**
 * Inverts `toHexPosition`: recovers the real-valued axial coordinate a scene position corresponds
 * to, so a Worley feature point scattered in scene space still measures its distance from the
 * origin in true hex-hop units.
 */
function toAxialPosition(x: number, y: number): readonly [number, number] {
  const cy = y / (HEX_SIZE * 1.5);
  const cx = x / (HEX_SIZE * SQRT_3) - cy / 2;

  return [cx, cy];
}

/**
 * Piecewise-linear interpolation over a roster entry's `(distance, weight)` breakpoints, ascending
 * by distance. Holds the first weight below the first breakpoint and the last weight past the last.
 */
function getWeightAtDistance(
  weights: ReadonlyArray<readonly [distance: number, weight: number]>,
  distance: number,
): number {
  const [first] = weights;

  invariant(first, 'a roster weight curve must carry at least one breakpoint');

  if (distance <= first[0]) {
    return first[1];
  }

  let previous = first;

  for (const point of weights) {
    if (distance <= point[0]) {
      const span = point[0] - previous[0];

      if (span === 0) {
        return point[1];
      }

      const t = (distance - previous[0]) / span;

      return previous[1] + (point[1] - previous[1]) * t;
    }

    previous = point;
  }

  return previous[1];
}

/**
 * Border proximity from the Worley gap between the nearest and second-nearest feature distances: 0
 * a full `BIOME_BLEND_BAND` inside a patch, ramping to 1 at the equidistant border.
 */
function getBorderBlend(nearestDistance: number, secondDistance: number): number {
  const gap = secondDistance - nearestDistance;
  const t = Math.min(Math.max(gap / BIOME_BLEND_BAND, 0), 1);

  return 1 - t;
}
