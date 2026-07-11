import { expect, test } from 'bun:test';
import { buildServiceAudience } from './build-service-audience';

test('it prefixes a service name with service-', () => {
  expect(buildServiceAudience('avatar')).toBe('service-avatar');
  expect(buildServiceAudience('session')).toBe('service-session');
  expect(buildServiceAudience('user')).toBe('service-user');
  expect(buildServiceAudience('verification')).toBe('service-verification');
});
