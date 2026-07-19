import { expect, test } from 'bun:test';
import { isRedirect } from '@tanstack/react-router';
import * as db from '@vers/mock-services/db';
import { HONEYPOT_FIELD_NAME } from '../../lib/auth/honeypot-field-names';
import { buildFormData } from '../../test-utils/build-form-data';
import { withRequestContext } from '../../test-utils/with-request-context';
import { runLogin } from './run-login';

test('it redirects home for an already signed-in caller', () => {
  const promise = withRequestContext({ cookies: { en_session: { sessionID: 'session-1' } } }, () =>
    runLogin(buildFormData({ email: 'x@vers.test', password: 'password123' })),
  );

  expect(promise).rejects.toMatchObject({ options: { href: '/' } });
});

test('it rejects a submission with a filled-in honeypot field', async () => {
  const formData = buildFormData({ email: 'x@vers.test', password: 'password123' });

  formData.set(HONEYPOT_FIELD_NAME, 'filled in by a bot');

  const outcome = await withRequestContext({}, () => runLogin(formData));

  if (!(outcome.value instanceof Response)) {
    throw new Error('expected a Response');
  }

  expect(outcome.value.status).toBe(400);
});

test('it reports field errors for an invalid email and a too-short password', async () => {
  const outcome = await withRequestContext({}, () =>
    runLogin(buildFormData({ email: 'not-an-email', password: 'short' })),
  );

  if (outcome.value instanceof Response) {
    throw new TypeError('expected a submission result');
  }

  expect(outcome.value.error).toStrictEqual({
    email: ['Email is invalid'],
    password: ['Password must be 8+ characters'],
  });
});

test('it reports a single form-level error for an unknown email', async () => {
  const outcome = await withRequestContext({}, () =>
    runLogin(buildFormData({ email: 'unknown@vers.test', password: 'password123' })),
  );

  if (outcome.value instanceof Response) {
    throw new TypeError('expected a submission result');
  }

  expect(outcome.value.error).toStrictEqual({ '': ['Invalid email or password'] });
});

test('it reports a single form-level error for the wrong password', async () => {
  await db.userCollection.create({
    email: 'wrong-password@vers.test',
    password: 'the-real-password',
  });

  const outcome = await withRequestContext({}, () =>
    runLogin(buildFormData({ email: 'wrong-password@vers.test', password: 'not-it-either' })),
  );

  if (outcome.value instanceof Response) {
    throw new TypeError('expected a submission result');
  }

  expect(outcome.value.error).toStrictEqual({ '': ['Invalid email or password'] });
});

test('it redirects to verify-otp and stores the pending session for a 2FA-enabled account', async () => {
  const user = await db.userCollection.create({
    email: 'two-factor@vers.test',
    password: 'password123',
  });

  await db.verificationCollection.create({ target: user.id, type: '2fa' });

  const outcome = await withRequestContext({}, async () => {
    const redirectHref = await runLogin(
      buildFormData({ email: 'two-factor@vers.test', password: 'password123' }),
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
  const user = await db.userCollection.create({
    email: 'force-logout@vers.test',
    password: 'password123',
  });

  await db.sessionCollection.create({ userID: user.id });

  const outcome = await withRequestContext({}, async () => {
    const redirectHref = await runLogin(
      buildFormData({ email: 'force-logout@vers.test', password: 'password123' }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/login/force-logout');

  expect(outcome.cookies['en_verification']).toStrictEqual({
    'loginLogout#email': 'force-logout@vers.test',
    'loginLogout#sessionID': expect.toBeString(),
    'loginLogout#userID': user.id,
  });
});

test('it stashes the redirect target alongside the pending force-logout session', async () => {
  const user = await db.userCollection.create({
    email: 'force-logout-redirect@vers.test',
    password: 'password123',
  });

  await db.sessionCollection.create({ userID: user.id });

  const outcome = await withRequestContext({}, () =>
    runLogin(
      buildFormData({
        email: 'force-logout-redirect@vers.test',
        password: 'password123',
        redirectTo: '/nexus',
      }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null)),
  );

  expect(outcome.cookies['en_verification']).toContainEntry(['loginLogout#redirect', '/nexus']);
});

test('it signs a first-time caller in directly and clears their redirect target', async () => {
  await db.userCollection.create({ email: 'first-login@vers.test', password: 'password123' });

  const outcome = await withRequestContext({}, async () => {
    const redirectHref = await runLogin(
      buildFormData({
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

test('it lands a caller with no redirect target at respite', async () => {
  await db.userCollection.create({ email: 'default-landing@vers.test', password: 'password123' });

  const outcome = await withRequestContext({}, async () => {
    const redirectHref = await runLogin(
      buildFormData({ email: 'default-landing@vers.test', password: 'password123' }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/avatars');
});
