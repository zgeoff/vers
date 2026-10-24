import { expect, test } from 'bun:test';
import { isRetryableProxyCall } from './is-retryable-proxy-call';

test('it marks a procedure its contract declares GET as retryable', () => {
  expect(isRetryableProxyCall('avatar', ['getAvatars'])).toBeTrue();
});

test('it marks a mutating procedure as not retryable', () => {
  expect(isRetryableProxyCall('avatar', ['updateAvatar'])).toBeFalse();
});

test('it marks a procedure no contract declares as not retryable', () => {
  expect(isRetryableProxyCall('avatar', ['noSuchProcedure'])).toBeFalse();
});

test('it marks a call to a service the browser has no contract for as not retryable', () => {
  expect(isRetryableProxyCall('keys', ['getKey'])).toBeFalse();
});
