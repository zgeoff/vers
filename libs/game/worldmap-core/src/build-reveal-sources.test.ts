import { expect, test } from 'bun:test';
import { buildRevealSources } from './build-reveal-sources';
import { ORIGIN_CELL, REVEAL_RADIUS, WORLD_COORD_MAX } from './consts';

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

test('it emits one origin disc when the origin itself is completed', () => {
  const sources = buildRevealSources(new Set(['0_0']));

  expect(sources).toStrictEqual([{ coord: ORIGIN_CELL, radius: REVEAL_RADIUS }]);
});

test('it skips a completed cell outside the Morton-packable range', () => {
  const sources = buildRevealSources(new Set([`${WORLD_COORD_MAX + 1}_0`]));

  expect(sources).toStrictEqual([{ coord: ORIGIN_CELL, radius: REVEAL_RADIUS }]);
});
