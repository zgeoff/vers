import { expect, test } from 'bun:test';
import { isRedirect } from '@tanstack/react-router';
import { mintStepUpTransactionToken } from '../../lib/auth/step-up-transaction-token';
import * as db from '../../mocks/db';
import { buildFormData } from '../../test-utils/build-form-data';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { changePasswordHandler } from './change-password-handler';

test('it reports a field error when the new passwords do not match', async () => {
  const signedIn = await createSignedInUser({ password: 'original-password' });

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
  const signedIn = await createSignedInUser({ password: 'original-password' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    changePasswordHandler(
      buildFormData({
        confirmPassword: 'new-password123',
        currentPassword: 'not-the-real-password',
        password: 'new-password123',
      }),
    ),
  );

  expect(outcome.value).toStrictEqual({
    formError: 'Current password is incorrect',
    status: 'invalid-credentials',
  });
});

test('it reports invalid credentials for the wrong current password before gating on step-up', async () => {
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({ target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    changePasswordHandler(
      buildFormData({
        confirmPassword: 'new-password123',
        currentPassword: 'not-the-real-password',
        password: 'new-password123',
      }),
    ),
  );

  expect(outcome.value).toStrictEqual({
    formError: 'Current password is incorrect',
    status: 'invalid-credentials',
  });

  expect(
    db.pendingTransactionCollection.findFirst((q) => q.where({ target: signedIn.userID })),
  ).toBeUndefined();
});

test('it changes the password and redirects to account for a caller with no 2FA', async () => {
  const signedIn = await createSignedInUser({ password: 'original-password' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const redirectHref = await changePasswordHandler(
      buildFormData({
        confirmPassword: 'new-password123',
        currentPassword: 'original-password',
        password: 'new-password123',
      }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/account');

  expect(db.userCollection.findFirst((q) => q.where({ id: signedIn.userID }))).toMatchObject({
    password: 'new-password123',
  });
});

test('it reports step-up-required for a 2FA-enabled caller with no transaction token', async () => {
  const signedIn = await createSignedInUser({ password: 'original-password' });

  await db.verificationCollection.create({ target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    changePasswordHandler(
      buildFormData({
        confirmPassword: 'new-password123',
        currentPassword: 'original-password',
        password: 'new-password123',
      }),
    ),
  );

  expect(outcome.value).toMatchObject({ status: 'step-up-required', target: signedIn.userID });
});

test('it changes the password once a valid step-up token is attached', async () => {
  const signedIn = await createSignedInUser({ password: 'original-password' });

  await db.verificationCollection.create({ target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const minted = await mintStepUpTransactionToken({
      action: 'ChangePassword',
      sessionID: signedIn.sessionID,
      target: signedIn.userID,
    });

    const redirectHref = await changePasswordHandler(
      buildFormData({
        confirmPassword: 'new-password123',
        currentPassword: 'original-password',
        password: 'new-password123',
        stepUpToken: minted.token,
      }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/account');
});
