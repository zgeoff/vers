import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { isRedirect } from '@tanstack/react-router';
import { mintStepUpTransactionToken } from '../../lib/auth/step-up-transaction-token';
import { sessionCollection, userCollection, verificationCollection } from '../../mocks/db';
import { buildFormData } from '../../test-utils/build-form-data';
import { withRequestContext } from '../../test-utils/with-request-context';
import { changeEmailHandler } from './change-email-handler';

async function createSignedInUser(): Promise<{
  readonly cookies: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly userID: string;
}> {
  const userID = createId();
  const sessionID = createId();

  await userCollection.create({ id: userID });

  await sessionCollection.create({ id: sessionID, userID });

  return {
    cookies: { en_session: { accessToken: sessionID, refreshToken: 'refresh', sessionID } },
    userID,
  };
}

test('it reports a field error for an invalid email', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    changeEmailHandler(buildFormData({ email: 'not-an-email' })),
  );

  expect(outcome.value).toStrictEqual({
    fieldErrors: { email: 'Email is invalid' },
    status: 'invalid-fields',
  });
});

test('it starts a change-email verification and redirects to verify-otp for a caller with no 2FA', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const redirectHref = await changeEmailHandler(buildFormData({ email: 'new@vers.test' }))
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/verify-otp?target=new%40vers.test&type=change-email');

  expect(
    verificationCollection.findFirst((q) => q.where({ target: 'new@vers.test' })),
  ).toMatchObject({ type: 'change-email' });
});

test('it reports step-up-required for a 2FA-enabled caller with no transaction token', async () => {
  const signedIn = await createSignedInUser();

  await verificationCollection.create({ target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    changeEmailHandler(buildFormData({ email: 'gated-new@vers.test' })),
  );

  expect(outcome.value).toMatchObject({ status: 'step-up-required', target: signedIn.userID });
});

test('it applies the change once a valid step-up token is attached', async () => {
  const signedIn = await createSignedInUser();

  await verificationCollection.create({ target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const minted = await mintStepUpTransactionToken({
      action: 'ChangeEmail',
      sessionID: null,
      target: signedIn.userID,
    });

    const redirectHref = await changeEmailHandler(
      buildFormData({ email: 'token-new@vers.test', stepUpToken: minted.token }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/verify-otp?target=token-new%40vers.test&type=change-email');
});
