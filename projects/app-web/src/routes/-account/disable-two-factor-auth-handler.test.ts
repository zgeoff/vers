import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { isRedirect } from '@tanstack/react-router';
import { sessionCollection } from '../../../mocks/db/session-collection';
import { userCollection } from '../../../mocks/db/user-collection';
import { verificationCollection } from '../../../mocks/db/verification-collection';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { mintStepUpTransactionToken } from '../../lib/auth/step-up-transaction-token';
import { disableTwoFactorAuthHandler } from './disable-two-factor-auth-handler';

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
    name: 'Disable 2FA',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: email.split('@')[0] ?? 'disable-2fa',
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

test('it reports an error when 2FA is not enabled', async () => {
  const signedIn = await createSignedInUser('not-enabled@vers.test');

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    disableTwoFactorAuthHandler(buildFormData({})),
  );

  expect(outcome.value).toStrictEqual({
    formError: 'Two-factor authentication is not enabled',
    status: 'error',
  });
});

test('it reports step-up-required with no transaction token', async () => {
  const signedIn = await createSignedInUser('gated-disable@vers.test');

  await verificationCollection.create({ id: createId(), target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    disableTwoFactorAuthHandler(buildFormData({})),
  );

  expect(outcome.value).toMatchObject({ status: 'step-up-required', target: signedIn.userID });
});

test('it removes the 2FA verification and redirects to account once a valid token is attached', async () => {
  const signedIn = await createSignedInUser('token-disable@vers.test');

  await verificationCollection.create({ id: createId(), target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const minted = await mintStepUpTransactionToken({
      action: 'TwoFactorAuthDisable',
      sessionID: null,
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
    verificationCollection.findFirst((q) => q.where({ target: signedIn.userID, type: '2fa' })),
  ).toBeUndefined();
});
