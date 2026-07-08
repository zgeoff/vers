import { expect, test } from 'bun:test';
import { isRedirect } from '@tanstack/react-router';
import { HONEYPOT_FIELD_NAME } from '../../lib/auth/honeypot-field-names';
import { sessionCollection, userCollection, verificationCollection } from '../../mocks/db';
import { withRequestContext } from '../../test-utils/with-request-context';
import { loginHandler } from './login-handler';

function buildLoginFormData(fields: Readonly<Record<string, string>>): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return formData;
}

test('it redirects home for an already signed-in caller', () => {
  const promise = withRequestContext({ cookies: { en_session: { sessionID: 'session-1' } } }, () =>
    loginHandler(buildLoginFormData({ email: 'x@vers.test', password: 'password123' })),
  );

  expect(promise).rejects.toMatchObject({ options: { href: '/' } });
});

test('it rejects a submission with a filled-in honeypot field', async () => {
  const formData = buildLoginFormData({ email: 'x@vers.test', password: 'password123' });

  formData.set(HONEYPOT_FIELD_NAME, 'filled in by a bot');

  const outcome = await withRequestContext({}, () => loginHandler(formData));

  if (!(outcome.value instanceof Response)) {
    throw new Error('expected a Response');
  }

  expect(outcome.value.status).toBe(400);
});

test('it reports field errors for an invalid email and a too-short password', async () => {
  const outcome = await withRequestContext({}, () =>
    loginHandler(buildLoginFormData({ email: 'not-an-email', password: 'short' })),
  );

  expect(outcome.value).toStrictEqual({
    fieldErrors: { email: 'Email is invalid', password: 'Password must be 8+ characters' },
    status: 'invalid-fields',
  });
});

test('it reports invalid credentials for an unknown email', async () => {
  const outcome = await withRequestContext({}, () =>
    loginHandler(buildLoginFormData({ email: 'unknown@vers.test', password: 'password123' })),
  );

  expect(outcome.value).toStrictEqual({ status: 'invalid-credentials' });
});

test('it reports invalid credentials for the wrong password', async () => {
  await userCollection.create({ email: 'wrong-password@vers.test', password: 'the-real-password' });

  const outcome = await withRequestContext({}, () =>
    loginHandler(
      buildLoginFormData({ email: 'wrong-password@vers.test', password: 'not-it-either' }),
    ),
  );

  expect(outcome.value).toStrictEqual({ status: 'invalid-credentials' });
});

test('it redirects to verify-otp and stores the pending session for a 2FA-enabled account', async () => {
  const user = await userCollection.create({
    email: 'two-factor@vers.test',
    password: 'password123',
  });

  await verificationCollection.create({ target: user.id, type: '2fa' });

  const outcome = await withRequestContext({}, async () => {
    const redirectHref = await loginHandler(
      buildLoginFormData({ email: 'two-factor@vers.test', password: 'password123' }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toStartWith('/verify-otp?');
  expect(outcome.cookies['en_verification']).toContainKey('login2FA#sessionID');
  expect(outcome.cookies['en_verification']).toContainEntry(['login2FA#target', user.id]);
});

test('it redirects to force-logout and stores the pending session when another session is live', async () => {
  const user = await userCollection.create({
    email: 'force-logout@vers.test',
    password: 'password123',
  });

  await sessionCollection.create({ userID: user.id });

  const outcome = await withRequestContext({}, async () => {
    const redirectHref = await loginHandler(
      buildLoginFormData({ email: 'force-logout@vers.test', password: 'password123' }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/login/force-logout');

  expect(outcome.cookies['en_verification']).toStrictEqual({
    'loginLogout#email': 'force-logout@vers.test',
    'loginLogout#sessionID': expect.toBeString(),
  });
});

test('it signs a first-time caller in directly and clears their redirect target', async () => {
  await userCollection.create({ email: 'first-login@vers.test', password: 'password123' });

  const outcome = await withRequestContext({}, async () => {
    const redirectHref = await loginHandler(
      buildLoginFormData({
        email: 'first-login@vers.test',
        password: 'password123',
        redirectTo: '/nexus',
      }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/nexus');
  expect(outcome.cookies['en_session']).toContainKeys(['accessToken', 'refreshToken', 'sessionID']);
});
