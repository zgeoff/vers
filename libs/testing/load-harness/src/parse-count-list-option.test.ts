import { expect, test } from 'bun:test';
import { parseCountListOption } from './parse-count-list-option';

test('it parses a comma-separated list of counts', () => {
  expect(parseCountListOption('25, 50,100')).toStrictEqual([25, 50, 100]);
});

test('it refuses a list with an entry that is not a count', () => {
  expect(() => parseCountListOption('25,,50')).toThrowWithMessage(Error, /got ""/u);
});
