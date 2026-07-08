import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { isRedirect } from '@tanstack/react-router';
import * as db from '../../mocks/db';
import { buildFormData } from '../../test-utils/build-form-data';
import { withRequestContext } from '../../test-utils/with-request-context';
import { avatarCreateHandler } from './avatar-create-handler';

async function createSignedInUser(): Promise<{
  readonly cookies: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly userID: string;
}> {
  const userID = createId();
  const sessionID = createId();

  await db.userCollection.create({ id: userID });

  await db.sessionCollection.create({ id: sessionID, userID });

  return {
    cookies: { en_session: { accessToken: sessionID, refreshToken: 'refresh', sessionID } },
    userID,
  };
}

test('it reports a field error for a missing class', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    avatarCreateHandler(buildFormData({ class: '', name: 'Karnak' })),
  );

  expect(outcome.value.status).toBe('invalid-fields');
  expect(outcome.value.fieldErrors.class).toBeString();
});

test('it reports a field error for an invalid name', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    avatarCreateHandler(buildFormData({ class: 'brute', name: 'x' })),
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
    avatarCreateHandler(buildFormData({ class: 'brute', name: 'Taken' })),
  );

  expect(outcome.value).toStrictEqual({
    fieldErrors: { name: 'An avatar with that name already exists' },
    status: 'invalid-fields',
  });
});

test('it creates the avatar and redirects to the avatar page', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const redirectHref = await avatarCreateHandler(
      buildFormData({ class: 'scoundrel', name: 'Karnak' }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/avatar');

  const created = db.avatarCollection.findFirst((q) =>
    q.where({ name: 'Karnak', userID: signedIn.userID }),
  );

  expect(created).toMatchObject({ class: 'scoundrel', level: 1, name: 'Karnak', xp: 0 });
});
