import { expect, test } from 'bun:test';
import { foldOptimisticBuild } from './fold-optimistic-build';

test('it folds settled xp alone when no source moved the total', () => {
  const build = foldOptimisticBuild(100, [
    { settledXP: 0, tailPayload: { type: 'progress' }, unverifiedDeltaSum: 0 },
  ]);

  expect(build).toStrictEqual({ totalXP: 100 });
});

test('it sums every source that moved the total', () => {
  const build = foldOptimisticBuild(100, [
    { settledXP: 0, tailPayload: { type: 'progress' }, unverifiedDeltaSum: 20 },
    {
      settledXP: 5,
      tailPayload: { rewards: { xp: 45 }, type: 'completed' },
      unverifiedDeltaSum: 0,
    },
  ]);

  expect(build).toStrictEqual({ totalXP: 160 });
});

test('it folds a negative terminal contribution into the total', () => {
  const build = foldOptimisticBuild(100, [
    {
      settledXP: 30,
      tailPayload: { rewards: { xp: 10 }, type: 'failed' },
      unverifiedDeltaSum: 0,
    },
  ]);

  expect(build).toStrictEqual({ totalXP: 80 });
});
