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

test('it produces the same field for the same input', () => {
  const viewport = { maxCX: 3, maxCY: 3, minCX: -3, minCY: -3 };

  expect(buildBiomeField(11, viewport, { resolution: 1 })).toStrictEqual(
    buildBiomeField(11, viewport, { resolution: 1 }),
  );
});

test('it agrees with getBiome called directly on the same cell at resolution 1', () => {
  const viewport = { maxCX: 5, maxCY: 5, minCX: -5, minCY: -5 };
  const field = buildBiomeField(23, viewport, { resolution: 1 });

  // texel (i, j) at resolution 1 lands exactly on axial (minCX + i, minCY + j) — probe the cell at
  // viewport-relative offset (3, 4)
  const cx = viewport.minCX + 3;
  const cy = viewport.minCY + 4;
  const index = 4 * field.cols + 3;
  const direct = getBiome(23, cx, cy);

  expect(field.baseIDs[index]).toBe(direct.baseID);
  expect(field.neighbourBaseIDs[index]).toBe(direct.neighbourBaseID);
  expect(field.modifierIDs[index]).toBe(direct.modifierID);

  // the field stores blendT in a Float32Array, so it carries less precision than the plain
  // 64-bit number getBiome returns for the same sample
  expect(field.blendTs[index]).toBeCloseTo(direct.blendT, 5);
});
