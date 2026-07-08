import { expect, test } from 'bun:test';
import * as db from '../mocks/db';
import { createSignedInUser } from './create-signed-in-user';

test('it creates a user with a verified session and a matching cookie map', async () => {
  const signedIn = await createSignedInUser();

  expect(db.userCollection.findFirst((q) => q.where({ id: signedIn.userID }))).toBeDefined();

  expect(db.sessionCollection.findFirst((q) => q.where({ id: signedIn.sessionID }))).toMatchObject({
    userID: signedIn.userID,
    verified: true,
  });

  expect(signedIn.cookies['en_session']).toStrictEqual({
    accessToken: signedIn.sessionID,
    refreshToken: 'refresh',
    sessionID: signedIn.sessionID,
  });
});

test('it applies user overrides to the created row', async () => {
  const signedIn = await createSignedInUser({ password: 'a-specific-password' });

  expect(signedIn.user.password).toBe('a-specific-password');
});
