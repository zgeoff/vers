import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { isRedirect } from '@tanstack/react-router';
import { sessionCollection } from '../../../mocks/db/session-collection';
import { userCollection } from '../../../mocks/db/user-collection';
import { verificationCollection } from '../../../mocks/db/verification-collection';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { verifyTwoFactorSetupHandler } from './verify-two-factor-setup-handler';

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
    name: 'Verify 2FA Setup',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: email.split('@')[0] ?? 'verify-2fa-setup',
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

function buildFormData(fields: Readonly<Record<string, string>>): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return formData;
}

test('it reports invalid code for a malformed submission', async () => {
  const signedIn = await createSignedInUser('malformed-2fa-setup@vers.test');

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    verifyTwoFactorSetupHandler(buildFormData({ code: 'abc', target: signedIn.userID })),
  );

  expect(outcome.value).toStrictEqual({ formError: 'Invalid code', status: 'invalid-fields' });
});

test('it reports invalid code for an incorrect code', async () => {
  const signedIn = await createSignedInUser('incorrect-2fa-setup@vers.test');

  await verificationCollection.create({
    id: createId(),
    code: '654321',
    target: signedIn.userID,
    type: '2fa-setup',
  });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    verifyTwoFactorSetupHandler(buildFormData({ code: '000000', target: signedIn.userID })),
  );

  expect(outcome.value).toStrictEqual({
    formError: 'Invalid or expired code',
    status: 'invalid-fields',
  });
});

test('it flips the verification to 2fa and redirects to account for a correct code', async () => {
  const signedIn = await createSignedInUser('correct-2fa-setup@vers.test');

  await verificationCollection.create({
    id: createId(),
    code: '123456',
    target: signedIn.userID,
    type: '2fa-setup',
  });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const redirectHref = await verifyTwoFactorSetupHandler(
      buildFormData({ code: '123456', target: signedIn.userID }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/account');

  expect(
    verificationCollection.findFirst((q) => q.where({ target: signedIn.userID })),
  ).toMatchObject({ type: '2fa' });
});
