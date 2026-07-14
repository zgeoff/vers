import { expect, test } from 'bun:test';
import * as jose from 'jose';
import { createTestAccessToken } from './create-test-access-token';

test('it mints a decodable token carrying the user as its subject with a future expiry', async () => {
  const token = await createTestAccessToken('user-1');

  const payload = jose.decodeJwt(token);

  expect(payload.sub).toBe('user-1');
  expect(payload.exp).toBeNumber();
  expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
});

test('it honors a custom expiry, including one already in the past', async () => {
  const token = await createTestAccessToken('user-1', '-1s');

  const payload = jose.decodeJwt(token);

  expect(payload.exp).toBeLessThan(Date.now() / 1000);
});
