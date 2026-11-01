import { expect, test } from 'bun:test';
import { isConditionMet } from './is-condition-met';

test('it reads a need result from the needs context', () => {
  expect(
    isConditionMet(
      {
        needs: ['bake'],
        condition: "!cancelled() && needs.bake.result == 'cancelled'",
        cancelsInProgress: false,
      },
      new Map([['bake', 'cancelled']]),
    ),
  ).toBeTrue();
});

test('it adds success() to a condition that calls no status function', () => {
  expect(
    isConditionMet(
      { needs: ['bake'], condition: "needs.bake.result != 'success'", cancelsInProgress: false },
      new Map([['bake', 'failure']]),
    ),
  ).toBeFalse();
});

test('it keeps cancelled() false after a cancelled need', () => {
  expect(
    isConditionMet(
      { needs: ['bake'], condition: 'cancelled()', cancelsInProgress: false },
      new Map([['bake', 'cancelled']]),
    ),
  ).toBeFalse();
});

test('it meets failure() when a need failed', () => {
  expect(
    isConditionMet(
      { needs: ['bake', 'wash'], condition: 'failure()', cancelsInProgress: false },
      new Map([
        ['bake', 'success'],
        ['wash', 'failure'],
      ]),
    ),
  ).toBeTrue();
});
