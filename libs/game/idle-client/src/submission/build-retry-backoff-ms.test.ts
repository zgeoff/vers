import { expect, test } from 'bun:test';
import { buildRetryBackoffMS } from './build-retry-backoff-ms';

test('it doubles the minimum timeout per attempt', () => {
  expect(buildRetryBackoffMS({ maxTimeout: 300_000, minTimeout: 10_000 }, 0)).toBe(10_000);
  expect(buildRetryBackoffMS({ maxTimeout: 300_000, minTimeout: 10_000 }, 3)).toBe(80_000);
});

test('it caps the delay at the maximum timeout', () => {
  expect(buildRetryBackoffMS({ maxTimeout: 300_000, minTimeout: 10_000 }, 9)).toBe(300_000);
});
