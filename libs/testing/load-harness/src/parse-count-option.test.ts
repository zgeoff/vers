import { expect, test } from 'bun:test';
import { parseCountOption } from './parse-count-option';

test('it parses a whole number', () => {
  expect(parseCountOption('25')).toBe(25);
});

test.each([['0'], ['-3'], ['2.5'], [''], ['many']])('it refuses %p', (value) => {
  expect(() => parseCountOption(value)).toThrowWithMessage(Error, /at least 1/u);
});
