import { expect, test } from 'bun:test';
import { BUNDLED_CONTENT_VERSION } from './bundled-content-version';

test('it exports the bundled content version as a string', () => {
  expect(BUNDLED_CONTENT_VERSION).toBe('2');
});
