import { expect, test } from 'bun:test';
import { isRedirect } from '@tanstack/react-router';
import * as db from '../../mocks/db';
import { buildFormData } from '../../test-utils/build-form-data';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { verifyTwoFactorSetupHandler } from './verify-two-factor-setup-handler';

test('it reports invalid code for a malformed submission', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    verifyTwoFactorSetupHandler(buildFormData({ code: 'abc', target: signedIn.userID })),
  );

  expect(outcome.value).toStrictEqual({ formError: 'Invalid code', status: 'invalid-fields' });
});

test('it reports invalid code for an incorrect code', async () => {
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({
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
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({ target: signedIn.userID, type: '2fa-setup' });

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
    db.verificationCollection.findFirst((q) => q.where({ target: signedIn.userID })),
  ).toMatchObject({ type: '2fa' });
});
