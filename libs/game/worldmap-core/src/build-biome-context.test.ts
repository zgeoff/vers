import { expect, test } from 'bun:test';
import { buildBiomeContext } from './build-biome-context';

test('it carries the seed through untouched', () => {
  expect(buildBiomeContext(42).userSeed).toBe(42);
});

test('it returns a fresh, empty cache pair independent of any other context', () => {
  const first = buildBiomeContext(1);

  first.featurePoints.set('probe', [0, 0]);
  first.rosterIDs.set('probe', 0);

  const second = buildBiomeContext(1);

  expect(second.featurePoints.size).toBe(0);
  expect(second.rosterIDs.size).toBe(0);
});
