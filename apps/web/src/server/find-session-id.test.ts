import { expect, test } from 'bun:test';
import {
  AUTH_SESSION_READ_MAX_AGE_SECONDS,
  buildAuthSessionConfig,
} from '../lib/auth/build-auth-session-config';
import { buildSealedSessionCookie } from '../test-utils/build-sealed-session-cookie';
import { findSessionID } from './find-session-id';

test('it reads the session id out of a sealed session cookie', async () => {
  const sealed = await buildSealedSessionCookie({ sessionID: 'sess-1', userID: 'user-1' });

  const request = new Request('https://example.test/api/rpc/user/getCurrentUser', {
    headers: { cookie: `en_session=${sealed}` },
  });

  expect(
    findSessionID(request, buildAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS)),
  ).resolves.toBe('sess-1');
});

test('it misses when the request carries no session cookie', () => {
  const request = new Request('https://example.test/api/rpc/user/getCurrentUser');

  expect(
    findSessionID(request, buildAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS)),
  ).resolves.toBeNull();
});

test('it misses when the session cookie is not sealed with the session secret', () => {
  const request = new Request('https://example.test/api/rpc/user/getCurrentUser', {
    headers: { cookie: 'en_session=forged-value' },
  });

  expect(
    findSessionID(request, buildAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS)),
  ).resolves.toBeNull();
});

test('it misses when a sealed cookie carries no signed-in session', async () => {
  const sealed = await buildSealedSessionCookie({});

  const request = new Request('https://example.test/api/rpc/user/getCurrentUser', {
    headers: { cookie: `en_session=${sealed}` },
  });

  expect(
    findSessionID(request, buildAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS)),
  ).resolves.toBeNull();
});
