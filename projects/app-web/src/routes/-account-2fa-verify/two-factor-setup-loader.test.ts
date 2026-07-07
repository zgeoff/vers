import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { isRedirect } from '@tanstack/react-router';
import { sessionCollection } from '../../../mocks/db/session-collection';
import { userCollection } from '../../../mocks/db/user-collection';
import { verificationCollection } from '../../../mocks/db/verification-collection';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { twoFactorSetupLoader } from './two-factor-setup-loader';

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
    name: 'Two Factor Setup',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: email.split('@')[0] ?? 'two-factor-setup',
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

test('it redirects to account when 2FA is already enabled', async () => {
  const signedIn = await createSignedInUser('already-enabled@vers.test');

  await verificationCollection.create({ id: createId(), target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const redirectHref = await twoFactorSetupLoader()
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/account');
});

test('it creates a pending 2fa-setup verification and returns its QR data for a fresh caller', async () => {
  const signedIn = await createSignedInUser('fresh-setup@vers.test');

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    twoFactorSetupLoader(),
  );

  expect(outcome.value.target).toBe(signedIn.userID);
  expect(outcome.value.otpURI).toStartWith('otpauth://totp/');
  expect(outcome.value.qrCodeDataURL).toStartWith('data:image/png;base64,');

  expect(
    verificationCollection.findFirst((q) =>
      q.where({ target: signedIn.userID, type: '2fa-setup' }),
    ),
  ).toBeDefined();
});

test('it reuses an existing pending 2fa-setup verification instead of rotating it', async () => {
  const signedIn = await createSignedInUser('existing-setup@vers.test');

  await verificationCollection.create({
    id: createId(),
    code: 'existing-code',
    target: signedIn.userID,
    type: '2fa-setup',
  });

  await withRequestContext({ cookies: signedIn.cookies }, () => twoFactorSetupLoader());

  expect(
    verificationCollection.findFirst((q) =>
      q.where({ target: signedIn.userID, type: '2fa-setup' }),
    ),
  ).toMatchObject({ code: 'existing-code' });
});
