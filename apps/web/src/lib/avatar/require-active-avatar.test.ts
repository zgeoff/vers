import { expect, test } from 'bun:test';
import * as db from '@vers/mock-services/db';
import { createActiveAvatar } from '../../test-utils/create-active-avatar';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { getAuthSession } from '../auth/get-auth-session';
import { requireActiveAvatar } from './require-active-avatar';

test('it redirects to the create sheet when the caller has no avatar', async () => {
  const signedIn = await createSignedInUser();

  const promise = withRequestContext({ cookies: signedIn.cookies }, () => requireActiveAvatar());

  expect(promise).rejects.toMatchObject({ options: { href: '/avatars/create' } });
});

test('it redirects to the roster when avatars exist but none is active', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ name: 'Karnak', userID: signedIn.userID });

  const promise = withRequestContext({ cookies: signedIn.cookies }, () => requireActiveAvatar());

  expect(promise).rejects.toMatchObject({ options: { href: '/avatars' } });
});

test('it does not redirect when the caller has an active avatar', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ name: 'Karnak', userID: signedIn.userID });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    requireActiveAvatar(),
  );

  expect(outcome.value).toBeUndefined();
});

test('it signs the caller out and redirects to login when another device took the session over', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ name: 'Karnak', userID: signedIn.userID });

  db.sessionCollection.delete((q) => q.where({ id: signedIn.sessionID }));

  const outcome = await withRequestContext(
    { cookies: signedIn.cookies, url: 'http://localhost/explore' },
    async () => {
      const promise = requireActiveAvatar();

      // the cookie read below must observe the rejected call's clear-session step settled
      await promise.catch(() => {});

      expect(promise).rejects.toMatchObject({ options: { href: '/login?redirect=%2Fexplore' } });

      return getAuthSession();
    },
  );

  expect(outcome.value).toStrictEqual({});
});
