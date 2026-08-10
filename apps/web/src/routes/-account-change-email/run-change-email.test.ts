import { expect, test } from 'bun:test';
import * as db from '@vers/mock-services/db';
import { createStepUpTransactionToken } from '../../lib/auth/create-step-up-transaction-token';
import { buildFormData } from '../../test-utils/build-form-data';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { runChangeEmail } from './run-change-email';

test('it reports a field error for an invalid email', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    runChangeEmail(buildFormData({ email: 'not-an-email' })),
  );

  expect(outcome.value).toStrictEqual({
    fieldErrors: { email: 'Email is invalid' },
    status: 'invalid-fields',
  });
});

test('it starts a change-email verification and redirects to verify-otp for a caller with no 2FA', async () => {
  const signedIn = await createSignedInUser();

  const promise = withRequestContext({ cookies: signedIn.cookies }, () =>
    runChangeEmail(buildFormData({ email: 'new@vers.test' })),
  );

  // the db reads below must observe the rejected call's verification/email side effects settled
  await promise.catch(() => {});

  expect(promise).rejects.toMatchObject({
    options: { href: '/verify-otp?target=new%40vers.test&type=change-email' },
  });

  const verification = db.verificationCollection.findFirst((q) =>
    q.where({ target: 'new@vers.test' }),
  );

  expect(verification).toMatchObject({ type: 'change-email' });

  const verificationEmail = db.sentEmailCollection.findFirst((q) =>
    q.where({ payload: { to: 'new@vers.test' }, template: 'send-change-email-verification' }),
  );

  expect(verificationEmail?.payload).toStrictEqual({
    newEmail: 'new@vers.test',
    to: 'new@vers.test',
    verificationCode: verification?.code ?? '',
    verificationURL: `http://localhost/verify-otp?${new URLSearchParams({ code: verification?.code ?? '', target: 'new@vers.test', type: 'change-email' }).toString()}`,
  });
});

test('it reports step-up-required for a 2FA-enabled caller with no transaction token', async () => {
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({ target: signedIn.userID, type: '2fa' });

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    runChangeEmail(buildFormData({ email: 'gated-new@vers.test' })),
  );

  expect(outcome.value).toMatchObject({ status: 'step-up-required', target: signedIn.userID });
});

test('it applies the change once a valid step-up token is attached', async () => {
  const signedIn = await createSignedInUser();

  await db.verificationCollection.create({ target: signedIn.userID, type: '2fa' });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const minted = await createStepUpTransactionToken({
      action: 'ChangeEmail',
      sessionID: signedIn.sessionID,
      target: signedIn.userID,
    });

    const promise = runChangeEmail(
      buildFormData({ email: 'token-new@vers.test', stepUpToken: minted.token }),
    );

    expect(promise).rejects.toMatchObject({
      options: { href: '/verify-otp?target=token-new%40vers.test&type=change-email' },
    });
  });
});
