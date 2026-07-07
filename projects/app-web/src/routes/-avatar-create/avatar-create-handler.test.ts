import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { isRedirect } from '@tanstack/react-router';
import { avatarCollection } from '../../../mocks/db/avatar-collection';
import { sessionCollection } from '../../../mocks/db/session-collection';
import { userCollection } from '../../../mocks/db/user-collection';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { avatarCreateHandler } from './avatar-create-handler';

async function createSignedInUser(email: string): Promise<{
  readonly cookies: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly userID: string;
}> {
  const userID = createId();
  const sessionID = createId();

  await userCollection.create({
    createdAt: new Date(),
    email,
    id: userID,
    name: 'Avatar Create',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: email.split('@')[0] ?? 'avatar-create',
  });

  await sessionCollection.create({
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    id: sessionID,
    ipAddress: '127.0.0.1',
    previousRefreshToken: null,
    refreshToken: null,
    updatedAt: new Date(),
    userID,
    verified: true,
  });

  return {
    cookies: { en_session: { accessToken: sessionID, refreshToken: 'refresh', sessionID } },
    userID,
  };
}

function buildAvatarCreateFormData(fields: Readonly<Record<string, string>>): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return formData;
}

test('it reports a field error for a missing class', async () => {
  const signedIn = await createSignedInUser('avatar-create-no-class@vers.test');

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    avatarCreateHandler(buildAvatarCreateFormData({ class: '', name: 'Karnak' })),
  );

  expect(outcome.value.status).toBe('invalid-fields');
  expect(outcome.value.fieldErrors.class).toBeString();
});

test('it reports a field error for an invalid name', async () => {
  const signedIn = await createSignedInUser('avatar-create-bad-name@vers.test');

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    avatarCreateHandler(buildAvatarCreateFormData({ class: 'brute', name: 'x' })),
  );

  expect(outcome.value).toStrictEqual({
    fieldErrors: { name: 'Name must be at least 3 characters' },
    status: 'invalid-fields',
  });
});

test('it reports a field error for a name that is already taken', async () => {
  const signedIn = await createSignedInUser('avatar-create-conflict@vers.test');

  await avatarCollection.create({
    class: 'scholar',
    createdAt: new Date(),
    id: createId(),
    level: 1,
    name: 'Taken',
    updatedAt: new Date(),
    userID: createId(),
    xp: 0,
  });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    avatarCreateHandler(buildAvatarCreateFormData({ class: 'brute', name: 'Taken' })),
  );

  expect(outcome.value).toStrictEqual({
    fieldErrors: { name: 'An avatar with that name already exists' },
    status: 'invalid-fields',
  });
});

test('it creates the avatar and redirects to the avatar page', async () => {
  const signedIn = await createSignedInUser('avatar-create-success@vers.test');

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const redirectHref = await avatarCreateHandler(
      buildAvatarCreateFormData({ class: 'scoundrel', name: 'Karnak' }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/avatar');

  const created = avatarCollection.findFirst((q) =>
    q.where({ name: 'Karnak', userID: signedIn.userID }),
  );

  expect(created).toMatchObject({ class: 'scoundrel', level: 1, name: 'Karnak', xp: 0 });
});
