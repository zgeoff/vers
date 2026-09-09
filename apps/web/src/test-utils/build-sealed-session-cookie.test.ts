import { expect, test } from 'bun:test';
import { H3Event, unsealSession } from 'h3';
import {
  AUTH_SESSION_READ_MAX_AGE_SECONDS,
  buildAuthSessionConfig,
} from '../lib/auth/build-auth-session-config';
import { buildSealedSessionCookie } from './build-sealed-session-cookie';

test('it seals a cookie the auth session config unseals back to the same data', async () => {
  const sealed = await buildSealedSessionCookie({ sessionID: 'sess-1', userID: 'user-1' });

  const session = await unsealSession(
    new H3Event(new Request('https://example.test/')),
    buildAuthSessionConfig(AUTH_SESSION_READ_MAX_AGE_SECONDS),
    sealed,
  );

  expect(session.data).toStrictEqual({ sessionID: 'sess-1', userID: 'user-1' });
});

test('it seals the same data to a different cookie value each time', async () => {
  const first = await buildSealedSessionCookie({ sessionID: 'sess-1' });
  const second = await buildSealedSessionCookie({ sessionID: 'sess-1' });

  expect(first).not.toBe(second);
});
