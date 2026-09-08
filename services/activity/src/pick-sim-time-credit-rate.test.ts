import { expect, test } from 'bun:test';
import { pickSimTimeCreditRate } from './pick-sim-time-credit-rate';

test('it credits a QA avatar at the maximum simulation speed', () => {
  expect(pickSimTimeCreditRate({ isQa: true })).toBe(20);
});

test('it credits every other avatar at wall-clock rate', () => {
  expect(pickSimTimeCreditRate({ isQa: false })).toBe(1);
});
