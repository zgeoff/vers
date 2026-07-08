import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { isRedirect } from '@tanstack/react-router';
import { mintStepUpTransactionToken } from '../../lib/auth/step-up-transaction-token';
import { sessionCollection, userCollection, verificationCollection } from '../../mocks/db';
import { withRequestContext } from '../../test-utils/with-request-context';
import { changePasswordHandler } from './change-password-handler';

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
    name: 'Change Password',
    password: 'original-password',
    seed: 0,
    updatedAt: new Date(),
    username: email.split('@')[0] ?? 'change-password',
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

const validNewPassword = { confirmPassword: 'new-password123', password: 'new-password123' };

test('it reports a field error when the new passwords do not match', async () => {
  const signedIn = await createSignedInUser('mismatch@vers.test');

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    changePasswordHandler(
      buildFormData({
        confirmPassword: 'different',
        currentPassword: 'original-password',
        password: 'new-password123',
      }),
    ),
  );

  expect(outcome.value).toStrictEqual({
    fieldErrors: { confirmPassword: 'The passwords must match' },
    status: 'invalid-fields',
  });
});

test('it reports invalid credentials for the wrong current password', async () => {
  const signedIn = await createSignedInUser('wrong-current@vers.test');

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    changePasswordHandler(
      buildFormData({ currentPassword: 'not-the-real-password', ...validNewPassword }),
    ),
  );

  expect(outcome.value).toStrictEqual({
    formError: 'Current password is incorrect',
    status: 'invalid-credentials',
  });
});

test('it changes the password and redirects to account for a caller with no 2FA', async () => {
  const signedIn = await createSignedInUser('no-2fa-password@vers.test');

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const redirectHref = await changePasswordHandler(
      buildFormData({ currentPassword: 'original-password', ...validNewPassword }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/account');

  expect(userCollection.findFirst((q) => q.where({ id: signedIn.userID }))).toMatchObject({
    password: 'new-password123',
  });
});

test('it reports step-up-required for a 2FA-enabled caller with no transaction token', async () => {
  const signedIn = await createSignedInUser('gated-password@vers.test');

  await verificationCollection.create({ id: createId(), target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    changePasswordHandler(
      buildFormData({ currentPassword: 'original-password', ...validNewPassword }),
    ),
  );

  expect(outcome.value).toMatchObject({ status: 'step-up-required', target: signedIn.userID });
});

test('it changes the password once a valid step-up token is attached', async () => {
  const signedIn = await createSignedInUser('token-password@vers.test');

  await verificationCollection.create({ id: createId(), target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const minted = await mintStepUpTransactionToken({
      action: 'ChangePassword',
      sessionID: null,
      target: signedIn.userID,
    });

    const redirectHref = await changePasswordHandler(
      buildFormData({
        currentPassword: 'original-password',
        stepUpToken: minted.token,
        ...validNewPassword,
      }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/account');
});
