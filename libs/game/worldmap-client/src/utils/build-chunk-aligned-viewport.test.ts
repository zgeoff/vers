import { expect, test } from 'bun:test';
import { REVEAL_VIEWPORT_CELL_CAP } from '@vers/contract-activity';
import { WORLD_COORD_MAX, WORLD_COORD_MIN } from '@vers/worldmap-core';
import { buildChunkAlignedViewport } from './build-chunk-aligned-viewport';

test('it rounds a viewport out to the chunk grid it overlaps', () => {
  expect(buildChunkAlignedViewport({ maxCX: 17, maxCY: 20, minCX: 1, minCY: -1 })).toStrictEqual({
    maxCX: 31,
    maxCY: 31,
    minCX: 0,
    minCY: -16,
  });
});

test('it leaves an already chunk-aligned viewport unchanged', () => {
  const viewport = { maxCX: 15, maxCY: 15, minCX: 0, minCY: 0 };

  expect(buildChunkAlignedViewport(viewport)).toStrictEqual(viewport);
});

test('it keeps two viewports inside the same chunk aligned to the identical box', () => {
  const first = buildChunkAlignedViewport({ maxCX: 3, maxCY: 3, minCX: 1, minCY: 1 });
  const second = buildChunkAlignedViewport({ maxCX: 10, maxCY: 10, minCX: 8, minCY: 8 });

  expect(first).toStrictEqual(second);
});

test('it clamps the aligned viewport to the positive coordinate range', () => {
  const viewport = buildChunkAlignedViewport({
    maxCX: WORLD_COORD_MAX,
    maxCY: WORLD_COORD_MAX,
    minCX: WORLD_COORD_MAX - 1,
    minCY: WORLD_COORD_MAX - 1,
  });

  expect(viewport.maxCX).toBe(WORLD_COORD_MAX);
  expect(viewport.maxCY).toBe(WORLD_COORD_MAX);
});

test('it clamps the aligned viewport to the negative coordinate range', () => {
  const viewport = buildChunkAlignedViewport({
    maxCX: WORLD_COORD_MIN + 1,
    maxCY: WORLD_COORD_MIN + 1,
    minCX: WORLD_COORD_MIN,
    minCY: WORLD_COORD_MIN,
  });

  expect(viewport.minCX).toBe(WORLD_COORD_MIN);
  expect(viewport.minCY).toBe(WORLD_COORD_MIN);
});

test('it shrinks an absurdly wide viewport to fit the cell cap centered on the original box', () => {
  // the footprint a pathologically wide canvas aspect would produce: enormous on one axis only
  const viewport = { maxCX: 600, maxCY: 8, minCX: -600, minCY: -8 };
  const aligned = buildChunkAlignedViewport(viewport);
  const capped = buildChunkAlignedViewport(viewport, REVEAL_VIEWPORT_CELL_CAP);
  const cellArea = (capped.maxCX - capped.minCX + 1) * (capped.maxCY - capped.minCY + 1);

  expect(cellArea).toBeLessThanOrEqual(REVEAL_VIEWPORT_CELL_CAP);
  expect(capped.minCX + capped.maxCX).toBe(aligned.minCX + aligned.maxCX);
  expect(capped.minCY + capped.maxCY).toBe(aligned.minCY + aligned.maxCY);
});

test('it shrinks an absurdly tall viewport to fit the cell cap centered on the original box', () => {
  const viewport = { maxCX: 8, maxCY: 600, minCX: -8, minCY: -600 };
  const aligned = buildChunkAlignedViewport(viewport);
  const capped = buildChunkAlignedViewport(viewport, REVEAL_VIEWPORT_CELL_CAP);
  const cellArea = (capped.maxCX - capped.minCX + 1) * (capped.maxCY - capped.minCY + 1);

  expect(cellArea).toBeLessThanOrEqual(REVEAL_VIEWPORT_CELL_CAP);
  expect(capped.minCX + capped.maxCX).toBe(aligned.minCX + aligned.maxCX);
  expect(capped.minCY + capped.maxCY).toBe(aligned.minCY + aligned.maxCY);
});

test('it leaves a viewport already under the cell cap unshrunk', () => {
  const viewport = { maxCX: 17, maxCY: 20, minCX: 1, minCY: -1 };

  expect(buildChunkAlignedViewport(viewport, REVEAL_VIEWPORT_CELL_CAP)).toStrictEqual(
    buildChunkAlignedViewport(viewport),
  );
});
