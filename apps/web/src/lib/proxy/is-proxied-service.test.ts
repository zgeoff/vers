import { expect, test } from 'bun:test';
import { isProxiedService } from './is-proxied-service';

test.each(['activity', 'avatar'] as const)('it proxies the %s service', (service) => {
  expect(isProxiedService(service)).toBeTrue();
});

test.each(['email', 'keys', 'replay', 'session', 'user', 'verification'] as const)(
  'it keeps the %s service off the browser proxy',
  (service) => {
    expect(isProxiedService(service)).toBeFalse();
  },
);
