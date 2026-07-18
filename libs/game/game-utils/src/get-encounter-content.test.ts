import { expect, test } from 'bun:test';
import { encounterContentV1 } from './content/encounter-content-v1';
import { getEncounterContent } from './get-encounter-content';

test('it resolves the registered content for a shipped content version', () => {
  expect(getEncounterContent('1')).toBe(encounterContentV1);
});

test('it rejects an unknown content version and names it', () => {
  expect(() => getEncounterContent('nope')).toThrowWithMessage(
    Error,
    /unknown content version: nope/,
  );
});

test('it rejects a version matching an inherited object key', () => {
  expect(() => getEncounterContent('constructor')).toThrowWithMessage(
    Error,
    /unknown content version: constructor/,
  );
});
