import { expect, test } from 'bun:test';
import { isNonNullable } from './is-non-nullable';

test.each([[1], [''], [false]])('it reports %p as non-nullable', (value) => {
  expect(isNonNullable(value)).toBeTrue();
});

test.each([[null], [undefined]])('it reports %p as nullable', (value) => {
  expect(isNonNullable(value)).toBeFalse();
});
