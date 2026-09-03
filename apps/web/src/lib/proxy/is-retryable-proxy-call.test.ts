import { expect, test } from 'bun:test';
import { isRetryableProxyCall } from './is-retryable-proxy-call';

test('it marks a procedure its contract declares GET as retryable', () => {
  expect(isRetryableProxyCall('user', ['getCurrentUser'])).toBeTrue();
});

test('it marks a mutating procedure as not retryable', () => {
  expect(isRetryableProxyCall('user', ['updateEmail'])).toBeFalse();
});

test('it marks a procedure no contract declares as not retryable', () => {
  expect(isRetryableProxyCall('user', ['noSuchProcedure'])).toBeFalse();
});

test('it marks a call to a service the browser has no contract for as not retryable', () => {
  expect(isRetryableProxyCall('keys', ['getKey'])).toBeFalse();
});
