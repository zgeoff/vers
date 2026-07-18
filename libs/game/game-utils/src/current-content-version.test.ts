import { expect, test } from 'bun:test';
import { CURRENT_CONTENT_VERSION } from './current-content-version';
import { getEncounterContent } from './get-encounter-content';

test('it resolves as a loadable content version', () => {
  expect(getEncounterContent(CURRENT_CONTENT_VERSION).contentVersion).toBe(CURRENT_CONTENT_VERSION);
});
