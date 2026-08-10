import { expect, test } from 'bun:test';
import { BUNDLED_CONTENT_VERSION } from './bundled-content-version';

test('it parses as a positive integer string, as the numeric gate comparison requires', () => {
  const parsed = Number(BUNDLED_CONTENT_VERSION);

  expect(Number.isInteger(parsed)).toBe(true);
  expect(parsed).toBeGreaterThan(0);
});
