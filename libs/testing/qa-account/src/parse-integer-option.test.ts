import { expect, test } from 'bun:test';
import { InvalidArgumentError } from 'commander';
import { parseIntegerOption } from './parse-integer-option';

test('it accepts an integer at the minimum', () => {
  expect(parseIntegerOption('1', 1)).toBe(1);
});

test('it accepts an integer above the minimum', () => {
  expect(parseIntegerOption('42', 0)).toBe(42);
});

test('it rejects an integer below the minimum', () => {
  expect(() => parseIntegerOption('0', 1)).toThrowWithMessage(
    InvalidArgumentError,
    /an integer of at least 1/,
  );
});

test('it rejects a fraction', () => {
  expect(() => parseIntegerOption('1.5', 1)).toThrowWithMessage(
    InvalidArgumentError,
    /an integer of at least 1/,
  );
});

test('it rejects text that is not a number', () => {
  expect(() => parseIntegerOption('six', 1)).toThrowWithMessage(
    InvalidArgumentError,
    /an integer of at least 1/,
  );
});

test('it rejects an integer beyond the safe range instead of rounding it', () => {
  expect(() => parseIntegerOption('9007199254740993', 0)).toThrowWithMessage(
    InvalidArgumentError,
    /an integer of at least 0/,
  );
});
