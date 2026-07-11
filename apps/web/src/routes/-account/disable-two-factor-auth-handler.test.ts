import { expect, test } from 'bun:test';
import { isRedirect } from '@tanstack/react-router';
import { mintStepUpTransactionToken } from '../../lib/auth/step-up-transaction-token';
import * as db from '../../mocks/db';
import { buildFormData } from '../../test-utils/build-form-data';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { disableTwoFactorAuthHandler } from './disable-two-factor-auth-handler';

test('it reports an error when 2FA is not enabled', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    disableTwoFactorAuthHandler(buildFormData({})),
  );

  expect(outcome.value).toStrictEqual({
    formError: 'Two-factor authentication is not enabled',
    status: 'error',
  });
});

test('it reports step-up-required with no transaction token', async () => {
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({ target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    disableTwoFactorAuthHandler(buildFormData({})),
  );

  expect(outcome.value).toMatchObject({ status: 'step-up-required', target: signedIn.userID });
});

test('it removes the 2FA verification and redirects to account once a valid token is attached', async () => {
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({ target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const minted = await mintStepUpTransactionToken({
      action: 'TwoFactorAuthDisable',
      sessionID: signedIn.sessionID,
      target: signedIn.userID,
    });

    const redirectHref = await disableTwoFactorAuthHandler(
      buildFormData({ stepUpToken: minted.token }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/account');

  expect(
    db.verificationCollection.findFirst((q) => q.where({ target: signedIn.userID, type: '2fa' })),
  ).toBeUndefined();
});
