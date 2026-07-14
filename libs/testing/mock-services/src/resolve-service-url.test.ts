import { expect, test } from 'bun:test';
import { updateEnv } from '@vers/test-utils/bun';
import { resolveServiceURL } from './resolve-service-url';

test('it falls back to the dev port when no env var is set', () => {
  expect(resolveServiceURL('activity')).toBe('http://localhost:3006');
});

test('it prefers the service env var', () => {
  updateEnv('ACTIVITY_SERVICE_URL', 'http://activity.internal:9000');
  expect(resolveServiceURL('activity')).toBe('http://activity.internal:9000');
});
