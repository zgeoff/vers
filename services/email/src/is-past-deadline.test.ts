import { expect, test } from 'bun:test';
import { isPastDeadline } from './is-past-deadline';

test('it reports a deadline in the past as past', () => {
  const usefulUntil = new Date(Date.now() - 1000);

  expect(isPastDeadline(usefulUntil)).toBeTrue();
});

test('it reports a deadline in the future as not past', () => {
  const usefulUntil = new Date(Date.now() + 60_000);

  expect(isPastDeadline(usefulUntil)).toBeFalse();
});
