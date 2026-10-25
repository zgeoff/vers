import { expect, test } from 'bun:test';
import { buildMockModelCheckpoint } from '../factories/build-mock-model-checkpoint';
import { buildPrefixXP } from './build-prefix-xp';

test('it sums the XP deltas of a prefix that ends before a terminal checkpoint', () => {
  const checkpoints = [
    buildMockModelCheckpoint({ type: 'started', version: 1, xp: 0 }),
    buildMockModelCheckpoint({ version: 2, xp: 10 }),
    buildMockModelCheckpoint({ version: 3, xp: 8 }),
    buildMockModelCheckpoint({ type: 'completed', version: 4, xp: 150 }),
  ];

  expect(buildPrefixXP(checkpoints, 3)).toBe(18);
});

test("it takes a terminal checkpoint's XP as the activity's whole total", () => {
  const checkpoints = [
    buildMockModelCheckpoint({ type: 'started', version: 1, xp: 0 }),
    buildMockModelCheckpoint({ version: 2, xp: 10 }),
    buildMockModelCheckpoint({ type: 'failed', version: 3, xp: 4 }),
  ];

  expect(buildPrefixXP(checkpoints, 3)).toBe(4);
});

test('it reads an empty prefix as no XP', () => {
  expect(buildPrefixXP([buildMockModelCheckpoint({ version: 1, xp: 10 })], 0)).toBe(0);
});
