import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { isRedirect } from '@tanstack/react-router';
import { sessionCollection } from '../../../mocks/db/session-collection';
import { userCollection } from '../../../mocks/db/user-collection';
import { verificationCollection } from '../../../mocks/db/verification-collection';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { HONEYPOT_FIELD_NAME } from '../../lib/auth/honeypot-field-names';
import { verifyOTPHandler } from './verify-otp-handler';

function buildVerifyOTPFormData(fields: Readonly<Record<string, string>>): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return formData;
}

test('it rejects a submission with a filled-in honeypot field', async () => {
  const formData = buildVerifyOTPFormData({ code: '123456', target: 'x', type: 'onboarding' });

  formData.set(HONEYPOT_FIELD_NAME, 'filled in by a bot');

  const outcome = await withRequestContext({}, () => verifyOTPHandler(formData));

  if (!(outcome.value instanceof Response)) {
    throw new Error('expected a Response');
  }

  expect(outcome.value.status).toBe(400);
});

test('it reports a form error for a code with the wrong length', async () => {
  const outcome = await withRequestContext({}, () =>
    verifyOTPHandler(buildVerifyOTPFormData({ code: '123', target: 'x', type: 'onboarding' })),
  );

  expect(outcome.value).toStrictEqual({ formError: 'Invalid code', status: 'invalid-fields' });
});

test('it reports a form error for a code that fails verification', async () => {
  await verificationCollection.create({
    code: '654321',
    id: createId(),
    target: 'verify-otp-wrong-code@vers.test',
    type: 'onboarding',
  });

  const outcome = await withRequestContext({}, () =>
    verifyOTPHandler(
      buildVerifyOTPFormData({
        code: '111111',
        target: 'verify-otp-wrong-code@vers.test',
        type: 'onboarding',
      }),
    ),
  );

  expect(outcome.value).toStrictEqual({
    formError: 'Invalid or expired code',
    status: 'invalid-fields',
  });
});

test('it records the verified email and redirects to onboarding', async () => {
  await verificationCollection.create({
    code: '222222',
    id: createId(),
    target: 'verify-otp-onboarding@vers.test',
    type: 'onboarding',
  });

  const outcome = await withRequestContext({}, async () => {
    const redirectHref = await verifyOTPHandler(
      buildVerifyOTPFormData({
        code: '222222',
        target: 'verify-otp-onboarding@vers.test',
        type: 'onboarding',
      }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/onboarding');

  expect(outcome.cookies['en_verification']).toStrictEqual({
    'onboarding#email': 'verify-otp-onboarding@vers.test',
  });
});

test('it bounces back to login when a 2FA verify has no pending session', async () => {
  await verificationCollection.create({
    code: '333333',
    id: createId(),
    target: 'user_no_pending_session',
    type: '2fa',
  });

  const outcome = await withRequestContext({}, async () => {
    const redirectHref = await verifyOTPHandler(
      buildVerifyOTPFormData({
        code: '333333',
        target: 'user_no_pending_session',
        type: '2fa',
      }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/login');
});

test('it completes a pending 2FA login and clears the redirect target', async () => {
  const user = await userCollection.create({
    createdAt: new Date(),
    email: 'verify-otp-2fa@vers.test',
    id: createId(),
    name: 'Verify OTP 2FA',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: 'verify-otp-2fa',
  });

  await verificationCollection.create({
    code: '444444',
    id: createId(),
    target: user.id,
    type: '2fa',
  });

  const pendingSession = await sessionCollection.create({
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    id: createId(),
    ipAddress: '127.0.0.1',
    previousRefreshToken: null,
    refreshToken: null,
    updatedAt: new Date(),
    userID: user.id,
    verified: false,
  });

  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'login2FA#sessionID': pendingSession.id } } },
    async () => {
      const redirectHref = await verifyOTPHandler(
        buildVerifyOTPFormData({
          code: '444444',
          redirect: '/nexus',
          target: user.id,
          type: '2fa',
        }),
      )
        .then(() => null)
        .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

      return redirectHref;
    },
  );

  expect(outcome.value).toBe('/nexus');
  expect(outcome.cookies['en_session']).toContainKeys(['accessToken', 'refreshToken', 'sessionID']);
  expect(outcome.cookies['en_verification']).toStrictEqual({});
});

test('it throws for a 2fa-setup verify, which this route does not support', async () => {
  await verificationCollection.create({
    code: '555555',
    id: createId(),
    target: 'user_2fa_setup',
    type: '2fa-setup',
  });

  const promise = withRequestContext({}, () =>
    verifyOTPHandler(
      buildVerifyOTPFormData({ code: '555555', target: 'user_2fa_setup', type: '2fa-setup' }),
    ),
  );

  expect(promise).rejects.toThrowWithMessage(
    Error,
    'this verification type is not supported by the verify-otp route',
  );
});

test('it applies a confirmed email change for the signed-in caller', async () => {
  const user = await userCollection.create({
    createdAt: new Date(),
    email: 'verify-otp-change-email-old@vers.test',
    id: createId(),
    name: 'Verify OTP Change Email',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: 'verify-otp-change-email',
  });

  const session = await sessionCollection.create({
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    id: createId(),
    ipAddress: '127.0.0.1',
    previousRefreshToken: null,
    refreshToken: createId(),
    updatedAt: new Date(),
    userID: user.id,
    verified: true,
  });

  await verificationCollection.create({
    code: '666666',
    id: createId(),
    target: 'verify-otp-change-email-new@vers.test',
    type: 'change-email',
  });

  const outcome = await withRequestContext(
    { cookies: { en_session: { accessToken: session.id, sessionID: session.id } } },
    async () => {
      const redirectHref = await verifyOTPHandler(
        buildVerifyOTPFormData({
          code: '666666',
          target: 'verify-otp-change-email-new@vers.test',
          type: 'change-email',
        }),
      )
        .then(() => null)
        .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

      return redirectHref;
    },
  );

  expect(outcome.value).toBe('/account');

  const updated = userCollection.findFirst((q) => q.where({ id: user.id }));

  expect(updated?.email).toBe('verify-otp-change-email-new@vers.test');
});
