import { expect, test } from 'bun:test';
import { isRedirect } from '@tanstack/react-router';
import * as db from '../../mocks/db';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { twoFactorSetupLoader } from './two-factor-setup-loader';

test('it redirects to account when 2FA is already enabled', async () => {
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({ target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const redirectHref = await twoFactorSetupLoader()
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/account');
});

test('it creates a pending 2fa-setup verification and returns its QR data for a fresh caller', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    twoFactorSetupLoader(),
  );

  expect(outcome.value.target).toBe(signedIn.userID);
  expect(outcome.value.otpURI).toStartWith('otpauth://totp/');
  expect(outcome.value.qrCodeDataURL).toStartWith('data:image/png;base64,');

  expect(
    db.verificationCollection.findFirst((q) =>
      q.where({ target: signedIn.userID, type: '2fa-setup' }),
    ),
  ).toBeDefined();
});

test('it reuses an existing pending 2fa-setup verification instead of rotating it', async () => {
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({
    code: 'existing-code',
    target: signedIn.userID,
    type: '2fa-setup',
  });

  await withRequestContext({ cookies: signedIn.cookies }, () => twoFactorSetupLoader());

  expect(
    db.verificationCollection.findFirst((q) =>
      q.where({ target: signedIn.userID, type: '2fa-setup' }),
    ),
  ).toMatchObject({ code: 'existing-code' });
});
