import { expect, test } from 'bun:test';
import { ORPCError } from '@orpc/client';
import { isRateLimitedError } from './is-rate-limited-error';

test('it recognises a 429 answer as rate-limited', () => {
  expect(isRateLimitedError(new ORPCError('TOO_MANY_REQUESTS', { status: 429 }))).toBeTrue();
});

test('it treats another server error as not rate-limited', () => {
  expect(isRateLimitedError(new ORPCError('SERVICE_UNAVAILABLE', { status: 503 }))).toBeFalse();
});

test('it treats a failed fetch as not rate-limited', () => {
  expect(isRateLimitedError(new TypeError('Failed to fetch'))).toBeFalse();
});
