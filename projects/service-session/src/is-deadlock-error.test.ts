import { expect, test } from 'bun:test';
import { isDeadlockError } from './is-deadlock-error';

test('it recognizes a driver error carrying the deadlock SQLSTATE', () => {
  expect(isDeadlockError({ code: '40P01' })).toBeTrue();
});

test('it rejects an error carrying a different SQLSTATE', () => {
  expect(isDeadlockError({ code: '23505' })).toBeFalse();
});

test('it rejects values that carry no code', () => {
  expect(isDeadlockError(new Error('deadlock detected'))).toBeFalse();
  expect(isDeadlockError(null)).toBeFalse();
  expect(isDeadlockError('40P01')).toBeFalse();
});
