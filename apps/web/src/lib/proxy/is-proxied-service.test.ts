import { expect, test } from 'bun:test';
import { isProxiedService } from './is-proxied-service';

test('it keeps the session service off the browser proxy', () => {
  expect(isProxiedService('session')).toBeFalse();
});

test('it proxies a service the browser calls', () => {
  expect(isProxiedService('activity')).toBeTrue();
});
