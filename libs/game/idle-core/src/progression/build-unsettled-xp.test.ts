import { expect, test } from 'bun:test';
import { buildUnsettledXP } from './build-unsettled-xp';

test('it sums unverified per-checkpoint deltas for a non-terminal tail', () => {
  const unsettledXP = buildUnsettledXP({
    settledXP: 10,
    tailPayload: { type: 'progress' },
    unverifiedDeltaSum: 15,
  });

  expect(unsettledXP).toBe(15);
});

test('it nets a terminal tail total against what the run already settled', () => {
  const unsettledXP = buildUnsettledXP({
    settledXP: 10,
    tailPayload: { rewards: { xp: 40 }, type: 'completed' },
    unverifiedDeltaSum: 999,
  });

  expect(unsettledXP).toBe(30);
});

test('it lets a failed terminal tail net negative as a death-penalty debit', () => {
  const unsettledXP = buildUnsettledXP({
    settledXP: 10,
    tailPayload: { rewards: { xp: 4 }, type: 'failed' },
    unverifiedDeltaSum: 0,
  });

  expect(unsettledXP).toBe(-6);
});
