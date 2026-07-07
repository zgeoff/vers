import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { isRedirect } from '@tanstack/react-router';
import { sessionCollection } from '../../../mocks/db/session-collection';
import { userCollection } from '../../../mocks/db/user-collection';
import { verificationCollection } from '../../../mocks/db/verification-collection';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { mintStepUpTransactionToken } from '../../lib/auth/step-up-transaction-token';
import { changeEmailHandler } from './change-email-handler';

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
    name: 'Change Email',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: email.split('@')[0] ?? 'change-email',
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

test('it reports a field error for an invalid email', async () => {
  const signedIn = await createSignedInUser('invalid-email@vers.test');

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    changeEmailHandler(buildFormData({ email: 'not-an-email' })),
  );

  expect(outcome.value).toStrictEqual({
    fieldErrors: { email: 'Email is invalid' },
    status: 'invalid-fields',
  });
});

test('it starts a change-email verification and redirects to verify-otp for a caller with no 2FA', async () => {
  const signedIn = await createSignedInUser('no-2fa-change@vers.test');

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
  const signedIn = await createSignedInUser('gated-change@vers.test');

  await verificationCollection.create({ id: createId(), target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    changeEmailHandler(buildFormData({ email: 'gated-new@vers.test' })),
  );

  expect(outcome.value).toMatchObject({ status: 'step-up-required', target: signedIn.userID });
});

test('it applies the change once a valid step-up token is attached', async () => {
  const signedIn = await createSignedInUser('token-change@vers.test');

  await verificationCollection.create({ id: createId(), target: signedIn.userID, type: '2fa' });

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
