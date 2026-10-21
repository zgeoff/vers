import { expect, test } from 'bun:test';
import { unsealData } from 'iron-session';
import { readSessionSecret } from '../lib/auth/read-session-secret';
import { sealSessionCookie } from './seal-session-cookie';

test('it seals a cookie the session secret unseals back to the same data', async () => {
  const sealed = await sealSessionCookie({ sessionID: 'sess-1', userID: 'user-1' });

  expect(unsealData(sealed, { password: readSessionSecret() })).resolves.toStrictEqual({
    sessionID: 'sess-1',
    userID: 'user-1',
  });
});

test('it seals the same data to a different cookie value each time', async () => {
  const first = await sealSessionCookie({ sessionID: 'sess-1' });
  const second = await sealSessionCookie({ sessionID: 'sess-1' });

  expect(first).not.toBe(second);
});
