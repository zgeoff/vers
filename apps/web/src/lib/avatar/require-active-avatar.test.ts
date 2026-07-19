import { expect, test } from 'bun:test';
import { isRedirect } from '@tanstack/react-router';
import * as db from '@vers/mock-services/db';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { requireActiveAvatar } from './require-active-avatar';

test('it redirects to the create sheet when the caller has no avatar', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    requireActiveAvatar()
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null)),
  );

  expect(outcome.value).toBe('/avatars/create');
});

test('it does not redirect when the caller has an avatar', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ name: 'Karnak', userID: signedIn.userID });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    requireActiveAvatar()
      .then(() => 'passed')
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : 'other-error')),
  );

  expect(outcome.value).toBe('passed');
});
