import { expect, test } from 'bun:test';
import { getTables } from './get-tables';
import { tablesV1 } from './tables/tables-v1';

test('it resolves the registered tables for a shipped content version', () => {
  expect(getTables('1')).toBe(tablesV1);
});

test('it rejects an unknown content version and names it', () => {
  expect(() => getTables('nope')).toThrowWithMessage(Error, /unknown content version: nope/);
});

test('it rejects a version matching an inherited object key', () => {
  expect(() => getTables('constructor')).toThrowWithMessage(
    Error,
    /unknown content version: constructor/,
  );
});
