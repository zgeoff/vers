import { expect, test } from 'bun:test';
import { BIOME_ROSTER, MODIFIER_ROSTER } from './consts';
import { getBiome } from './get-biome';

test('it draws identical samples for repeated calls with the same seed and cell', () => {
  expect(getBiome(42, 7, -3)).toStrictEqual(getBiome(42, 7, -3));
});

test('it moves with the avatar seed', () => {
  expect(getBiome(1, 30, 30)).not.toStrictEqual(getBiome(2, 30, 30));
});

test('it draws a stable field for a fixed seed', () => {
  const points: Array<readonly [number, number]> = [
    [0, 0],
    [3, -2],
    [-5, 4],
    [12, 7],
    [-30, 18],
  ];

  expect(points.map(([cx, cy]) => getBiome(9001, cx, cy))).toMatchInlineSnapshot(`
    [
      {
        "baseID": 3,
        "blendT": 0.2562528820559893,
        "modifierID": 0,
        "neighbourBaseID": 0,
      },
      {
        "baseID": 0,
        "blendT": 0,
        "modifierID": 0,
        "neighbourBaseID": 3,
      },
      {
        "baseID": 3,
        "blendT": 0.8364022641365576,
        "modifierID": 0,
        "neighbourBaseID": 3,
      },
      {
        "baseID": 3,
        "blendT": 0,
        "modifierID": 0,
        "neighbourBaseID": 0,
      },
      {
        "baseID": 0,
        "blendT": 0,
        "modifierID": 0,
        "neighbourBaseID": 0,
      },
    ]
  `);
});

const BASE_IDS = new Set(BIOME_ROSTER.map((entry) => entry.id));
const MODIFIER_IDS = new Set(MODIFIER_ROSTER.map((entry) => entry.id));

test('it always returns a roster base id, neighbour id, and modifier id', () => {
  for (let cx = -20; cx <= 20; cx += 4) {
    for (let cy = -20; cy <= 20; cy += 4) {
      const sample = getBiome(13, cx, cy);

      expect(BASE_IDS.has(sample.baseID)).toBe(true);
      expect(BASE_IDS.has(sample.neighbourBaseID)).toBe(true);
      expect(MODIFIER_IDS.has(sample.modifierID)).toBe(true);
    }
  }
});

test('it keeps blendT within the unit interval', () => {
  for (let cx = -20; cx <= 20; cx += 3) {
    for (let cy = -20; cy <= 20; cy += 3) {
      const sample = getBiome(21, cx, cy);

      expect(sample.blendT).toBeGreaterThanOrEqual(0);
      expect(sample.blendT).toBeLessThanOrEqual(1);
    }
  }
});

const DEEP_ONLY_ID = 2;

test('it never draws the deep-only biome near the origin', () => {
  for (let cx = -5; cx <= 5; cx++) {
    for (let cy = -5; cy <= 5; cy++) {
      const sample = getBiome(55, cx, cy);

      expect(sample.baseID).not.toBe(DEEP_ONLY_ID);
      expect(sample.neighbourBaseID).not.toBe(DEEP_ONLY_ID);
    }
  }
});

test('it draws at least three distinct base biomes in a far band', () => {
  const seen = new Set<number>();

  for (let cx = 280; cx <= 320; cx += 4) {
    for (let cy = 280; cy <= 320; cy += 4) {
      seen.add(getBiome(77, cx, cy).baseID);
    }
  }

  expect(seen.size).toBeGreaterThanOrEqual(3);
});

test('it draws a non-none modifier somewhere across a wide sweep', () => {
  const seen = new Set<number>();

  for (let cx = -60; cx <= 60; cx += 2) {
    for (let cy = -60; cy <= 60; cy += 2) {
      seen.add(getBiome(5, cx, cy).modifierID);
    }
  }

  expect(seen.size).toBeGreaterThanOrEqual(2);
});
