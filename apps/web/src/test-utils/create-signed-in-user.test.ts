import { expect, test } from 'bun:test';
import * as jose from 'jose';
import * as db from '../mocks/db';
import { createSignedInUser } from './create-signed-in-user';

test('it creates a user with a verified session and a matching cookie map', async () => {
  const signedIn = await createSignedInUser();

  expect(db.userCollection.findFirst((q) => q.where({ id: signedIn.userID }))).toBeDefined();

  const session = db.sessionCollection.findFirst((q) => q.where({ id: signedIn.sessionID }));

  expect(session).toMatchObject({ userID: signedIn.userID, verified: true });

  expect(signedIn.cookies['en_session']).toStrictEqual({
    accessToken: expect.toBeString(),
    refreshToken: session?.refreshToken,
    sessionID: signedIn.sessionID,
    userID: signedIn.userID,
  });

  const accessToken = signedIn.cookies['en_session']?.['accessToken'];

  if (typeof accessToken !== 'string') {
    throw new TypeError('expected a string accessToken');
  }

  expect(jose.decodeJwt(accessToken)).toMatchObject({ sub: signedIn.userID });
});

test('it applies user overrides to the created row', async () => {
  const signedIn = await createSignedInUser({ password: 'a-specific-password' });

  expect(signedIn.user.password).toBe('a-specific-password');
});
