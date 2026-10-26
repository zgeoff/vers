import { expect, test } from 'bun:test';
import { parseSeconds } from './parse-seconds';

test('it accepts zero seconds', () => {
  expect(parseSeconds('0')).toBe(0);
});

test('it accepts a fraction of a second', () => {
  expect(parseSeconds('1.5')).toBe(1.5);
});

test('it rejects a negative number', () => {
  expect(() => parseSeconds('-1')).toThrowWithMessage(
    Error,
    'expected a non-negative number of seconds, got "-1"',
  );
});

test('it rejects text that is not a number', () => {
  expect(() => parseSeconds('soon')).toThrowWithMessage(
    Error,
    'expected a non-negative number of seconds, got "soon"',
  );
});

test('it rejects an empty value instead of reading it as zero', () => {
  expect(() => parseSeconds('')).toThrowWithMessage(
    Error,
    'expected a non-negative number of seconds, got ""',
  );
});
