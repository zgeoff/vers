import { expect, test } from 'bun:test';
import { scatterBuildStats } from './scatter-build-stats';

test('it starts at zero for every field', () => {
  expect(scatterBuildStats).toStrictEqual({
    buildMs: 0,
    glowCount: 0,
    partCount: 0,
  });
});
