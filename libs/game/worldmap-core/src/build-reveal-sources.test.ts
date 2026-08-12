import { expect, test } from 'bun:test';
import { buildRevealSources } from './build-reveal-sources';
import { ORIGIN_CELL, REVEAL_RADIUS } from './consts';

test('it seeds the origin disc for an empty completed set', () => {
  expect(buildRevealSources(new Set())).toStrictEqual([
    { coord: ORIGIN_CELL, radius: REVEAL_RADIUS },
  ]);
});

test('it builds one disc per addressable completed node', () => {
  const sources = buildRevealSources(new Set(['1_2', '-3_4']));

  expect(sources).toStrictEqual([
    { coord: ORIGIN_CELL, radius: REVEAL_RADIUS },
    { coord: [1, 2], radius: REVEAL_RADIUS },
    { coord: [-3, 4], radius: REVEAL_RADIUS },
  ]);
});

test('it skips a completed id that names no addressable cell', () => {
  const sources = buildRevealSources(new Set(['not-a-cell']));

  expect(sources).toStrictEqual([{ coord: ORIGIN_CELL, radius: REVEAL_RADIUS }]);
});
