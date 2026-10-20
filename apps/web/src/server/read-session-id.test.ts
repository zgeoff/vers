import { expect, test } from 'bun:test';
import {
  AUTH_SESSION_READ_MAX_AGE_SECONDS,
  readAuthSessionConfig,
} from '../lib/auth/read-auth-session-config';
import { sealSessionCookie } from '../test-utils/seal-session-cookie';
import { readSessionID } from './read-session-id';

test('it reads the session id out of a sealed session cookie', async () => {
  const sealed = await sealSessionCookie({ sessionID: 'sess-1', userID: 'user-1' });

  const request = new Request('https://example.test/api/rpc/user/getCurrentUser', {
    headers: { cookie: `en_session=${sealed}` },
  });

  expect(
    readSessionID(request, readAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS)),
  ).resolves.toBe('sess-1');
});

test('it misses when the request carries no session cookie', () => {
  const request = new Request('https://example.test/api/rpc/user/getCurrentUser');

  expect(
    readSessionID(request, readAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS)),
  ).resolves.toBeNull();
});

test('it misses when the session cookie is not sealed with the session secret', () => {
  const request = new Request('https://example.test/api/rpc/user/getCurrentUser', {
    headers: { cookie: 'en_session=forged-value' },
  });

  expect(
    readSessionID(request, readAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS)),
  ).resolves.toBeNull();
});

test('it misses when a sealed cookie carries no signed-in session', async () => {
  const sealed = await sealSessionCookie({});

  const request = new Request('https://example.test/api/rpc/user/getCurrentUser', {
    headers: { cookie: `en_session=${sealed}` },
  });

  expect(
    readSessionID(request, readAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS)),
  ).resolves.toBeNull();
});
