import { expect, test } from 'bun:test';
import { isRedirect } from '@tanstack/react-router';
import * as db from '@vers/mock-services/db';
import { buildFormData } from '../../test-utils/build-form-data';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { runAvatarCreate } from './run-avatar-create';

test('it reports a field error for an invalid name', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    runAvatarCreate(buildFormData({ name: 'x' })),
  );

  expect(outcome.value).toStrictEqual({
    fieldErrors: { name: 'Name must be at least 3 characters' },
    status: 'invalid-fields',
  });
});

test('it reports a field error for a name that is already taken', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ name: 'Taken' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    runAvatarCreate(buildFormData({ name: 'Taken' })),
  );

  expect(outcome.value).toStrictEqual({
    fieldErrors: { name: 'An avatar with that name already exists' },
    status: 'invalid-fields',
  });
});

test('it creates the avatar and redirects to the avatar page', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const redirectHref = await runAvatarCreate(buildFormData({ name: 'Karnak' }))
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/avatar');

  const created = db.avatarCollection.findFirst((q) =>
    q.where({ name: 'Karnak', userID: signedIn.userID }),
  );

  expect(created).toMatchObject({ level: 1, mode: 'trade', name: 'Karnak', xp: 0 });
});

test('it creates a Self-Found avatar when that mode is requested', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    runAvatarCreate(buildFormData({ mode: 'self_found', name: 'Vagrant' }))
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null)),
  );

  expect(outcome.value).toBe('/avatar');

  const created = db.avatarCollection.findFirst((q) =>
    q.where({ name: 'Vagrant', userID: signedIn.userID }),
  );

  expect(created).toMatchObject({ mode: 'self_found' });
});
