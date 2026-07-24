import { expect, test } from 'bun:test';
import { foldOptimisticBuild } from './fold-optimistic-build';

test('it folds settled xp alone when no source moved the total', () => {
  const build = foldOptimisticBuild(100, [
    { id: 'act_a', settledXP: 0, tailPayload: { type: 'progress' }, unverifiedDeltaSum: 0 },
  ]);

  expect(build).toStrictEqual({ sourceIDs: [], totalXP: 100 });
});

test('it sums every source that moved the total and records its id', () => {
  const build = foldOptimisticBuild(100, [
    { id: 'act_a', settledXP: 0, tailPayload: { type: 'progress' }, unverifiedDeltaSum: 20 },
    {
      id: 'act_b',
      settledXP: 5,
      tailPayload: { rewards: { xp: 45 }, type: 'completed' },
      unverifiedDeltaSum: 0,
    },
  ]);

  expect(build).toStrictEqual({ sourceIDs: ['act_a', 'act_b'], totalXP: 160 });
});

test('it folds a negative terminal contribution into the total', () => {
  const build = foldOptimisticBuild(100, [
    {
      id: 'act_a',
      settledXP: 30,
      tailPayload: { rewards: { xp: 10 }, type: 'failed' },
      unverifiedDeltaSum: 0,
    },
  ]);

  expect(build).toStrictEqual({ sourceIDs: ['act_a'], totalXP: 80 });
});
