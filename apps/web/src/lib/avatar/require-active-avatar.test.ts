import { expect, test } from 'bun:test';
import * as db from '@vers/mock-services/db';
import { createActiveAvatar } from '../../test-utils/create-active-avatar';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { requireActiveAvatar } from './require-active-avatar';

test('it redirects to the create sheet when the caller has no avatar', async () => {
  const signedIn = await createSignedInUser();

  const promise = withRequestContext({ cookies: signedIn.cookies }, () => requireActiveAvatar());

  await expect(promise).rejects.toMatchObject({ options: { href: '/avatars/create' } });
});

test('it redirects to the roster when avatars exist but none is active', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ name: 'Karnak', userID: signedIn.userID });

  const promise = withRequestContext({ cookies: signedIn.cookies }, () => requireActiveAvatar());

  await expect(promise).rejects.toMatchObject({ options: { href: '/avatars' } });
});

test('it does not redirect when the caller has an active avatar', async () => {
  const signedIn = await createSignedInUser();

  await createActiveAvatar({ name: 'Karnak', userID: signedIn.userID });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    requireActiveAvatar(),
  );

  expect(outcome.value).toBeUndefined();
});
