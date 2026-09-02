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

export function getBiome(userSeed: number, cx: number, cy: number): BiomeSample {
  const [hexX, hexY] = toHexPosition(cx, cy);
  const wobbleSampleX = hexX * BIOME_EDGE_WOBBLE_FREQUENCY;
  const wobbleSampleY = hexY * BIOME_EDGE_WOBBLE_FREQUENCY;
  const wobbleX = buildValueNoise(userSeed, wobbleSampleX, wobbleSampleY, HASH_CHANNEL.wobbleX);
  const wobbleY = buildValueNoise(userSeed, wobbleSampleX, wobbleSampleY, HASH_CHANNEL.wobbleY);
  const warpedX = hexX + BIOME_EDGE_WOBBLE_AMPLITUDE * (wobbleX - 0.5);
  const warpedY = hexY + BIOME_EDGE_WOBBLE_AMPLITUDE * (wobbleY - 0.5);

  // Reads both nearest and second-nearest feature points: blendT and neighbourBaseID need the
  // second-nearest for the border blend.
  const base = buildNearestFeaturePoints(
    userSeed,
    warpedX,
    warpedY,
    BIOME_PATCH_SIZE,
    HASH_CHANNEL.worleyFeatureX,
    HASH_CHANNEL.worleyFeatureY,
  );

  // The modifier layer has no border blend, so only its nearest feature point is read.
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

  // 5×5, not 3×3: a feature point jitters anywhere inside its coarse cell, so a sample near a cell
  // corner can sit closer to a feature two rings out than to every feature in the 3×3 window,
  // while every cell three or more rings out lies at least 2 patch units away
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

function toAxialPosition(x: number, y: number): readonly [number, number] {
  const cy = y / (HEX_SIZE * 1.5);
  const cx = x / (HEX_SIZE * SQRT_3) - cy / 2;

  return [cx, cy];
}

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

function getBorderBlend(nearestDistance: number, secondDistance: number): number {
  const gap = secondDistance - nearestDistance;
  const t = Math.min(Math.max(gap / BIOME_BLEND_BAND, 0), 1);

  return 1 - t;
}
