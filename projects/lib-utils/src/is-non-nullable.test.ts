import { expect, test } from 'vitest';
import { isNonNullable } from './is-non-nullable';

test.each([[1], [''], [false]])('should return true for non-nullable values', (value) => {
  expect(isNonNullable(value)).toBeTrue();
});

test.each([[null], [undefined]])('should return false for nullable values', (value) => {
  expect(isNonNullable(value)).toBeFalse();
});
