import { expect, test } from 'bun:test';
import { buildBiomeField } from './build-biome-field';
import { buildRevealDistanceField } from './build-reveal-distance-field';
import { getBiome } from './get-biome';

test('it lays texels out on the same grid as the reveal distance field for the same viewport and resolution', () => {
  const viewport = { maxCX: 4, maxCY: 4, minCX: -4, minCY: -4 };
  const biomeField = buildBiomeField(7, viewport, { resolution: 2 });
  const revealField = buildRevealDistanceField([], viewport, { falloff: 1, resolution: 2 });

  expect(biomeField.cols).toBe(revealField.cols);
  expect(biomeField.rows).toBe(revealField.rows);
});

test('it rejects a resolution that is not a positive integer', () => {
  const viewport = { maxCX: 1, maxCY: 1, minCX: -1, minCY: -1 };

  expect(() => buildBiomeField(7, viewport, { resolution: 0 })).toThrow(
    'resolution must be a positive integer',
  );

  expect(() => buildBiomeField(7, viewport, { resolution: 1.5 })).toThrow(
    'resolution must be a positive integer',
  );
});

test('it produces the same field for the same input', () => {
  const viewport = { maxCX: 3, maxCY: 3, minCX: -3, minCY: -3 };

  expect(buildBiomeField(11, viewport, { resolution: 1 })).toStrictEqual(
    buildBiomeField(11, viewport, { resolution: 1 }),
  );
});

test('it wears each node cell its own biome across a viewport spanning many coarse cells', () => {
  // texel (i, j) at resolution 1 lands exactly on axial (minCX + i, minCY + j) — a cell's own
  // texel, whose nearest jittered node is always the cell's own since jitter stays inside the cell
  const viewport = { maxCX: 20, maxCY: 20, minCX: -20, minCY: -20 };
  const field = buildBiomeField(31, viewport, { resolution: 1 });

  for (let cy = viewport.minCY; cy <= viewport.maxCY; cy++) {
    for (let cx = viewport.minCX; cx <= viewport.maxCX; cx++) {
      const index = (cy - viewport.minCY) * field.cols + (cx - viewport.minCX);
      const direct = getBiome(31, cx, cy);

      expect(field.baseIDs[index]).toBe(direct.baseID);
      expect(field.modifierIDs[index]).toBe(direct.modifierID);
    }
  }
});

test('it keeps blendT inside the unit interval and raises it only across a real biome border', () => {
  const viewport = { maxCX: 12, maxCY: 12, minCX: -12, minCY: -12 };
  const field = buildBiomeField(23, viewport, { resolution: 2 });

  for (let index = 0; index < field.cols * field.rows; index++) {
    const blendT = field.blendTs[index] ?? 0;

    expect(blendT).toBeGreaterThanOrEqual(0);
    expect(blendT).toBeLessThanOrEqual(1);

    if (blendT > 0) {
      expect(field.baseIDs[index]).not.toBe(field.neighbourBaseIDs[index]);
    }
  }
});
