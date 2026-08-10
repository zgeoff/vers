import { expect, test } from 'bun:test';
import * as db from '@vers/mock-services/db';
import invariant from 'tiny-invariant';
import { HONEYPOT_FIELD_NAME } from '../../lib/auth/honeypot-field-names';
import { buildFormData } from '../../test-utils/build-form-data';
import { withRequestContext } from '../../test-utils/with-request-context';
import { runSignup } from './run-signup';

test('it redirects home for an already signed-in caller', () => {
  const promise = withRequestContext({ cookies: { en_session: { sessionID: 'session-1' } } }, () =>
    runSignup(buildFormData({ email: 'x@vers.test' })),
  );

  expect(promise).rejects.toMatchObject({ options: { href: '/' } });
});

test('it rejects a submission with a filled-in honeypot field', async () => {
  const formData = buildFormData({ email: 'x@vers.test' });

  formData.set(HONEYPOT_FIELD_NAME, 'filled in by a bot');

  const outcome = await withRequestContext({}, () => runSignup(formData));

  invariant(outcome.value instanceof Response, 'expected a Response');

  expect(outcome.value.status).toBe(400);
});

test('it reports a field error for an invalid email', async () => {
  const outcome = await withRequestContext({}, () =>
    runSignup(buildFormData({ email: 'not-an-email' })),
  );

  invariant(!(outcome.value instanceof Response), 'expected a submission result');

  expect(outcome.value.error).toStrictEqual({ email: ['Email is invalid'] });
});

test('it redirects to verify-otp without creating a verification for an email already in use', async () => {
  await db.userCollection.create({ email: 'signup-existing@vers.test' });

  const promise = withRequestContext({}, () =>
    runSignup(buildFormData({ email: 'signup-existing@vers.test' })),
  );

  await expect(promise).rejects.toMatchObject({
    options: { href: '/verify-otp?target=signup-existing%40vers.test&type=onboarding' },
  });

  const verification = db.verificationCollection.findFirst((q) =>
    q.where({ target: 'signup-existing@vers.test', type: 'onboarding' }),
  );

  expect(verification).toBeUndefined();

  const existingAccountEmail = db.sentEmailCollection.findFirst((q) =>
    q.where({ payload: { to: 'signup-existing@vers.test' }, template: 'send-existing-account' }),
  );

  expect(existingAccountEmail?.payload).toStrictEqual({
    email: 'signup-existing@vers.test',
    to: 'signup-existing@vers.test',
  });

  const welcomeEmail = db.sentEmailCollection.findFirst((q) =>
    q.where({ payload: { to: 'signup-existing@vers.test' }, template: 'send-welcome' }),
  );

  expect(welcomeEmail).toBeUndefined();
});

test('it creates an onboarding verification and redirects to verify-otp', async () => {
  const promise = withRequestContext({}, () =>
    runSignup(buildFormData({ email: 'signup-new@vers.test' })),
  );

  await expect(promise).rejects.toMatchObject({
    options: { href: '/verify-otp?target=signup-new%40vers.test&type=onboarding' },
  });

  const verification = db.verificationCollection.findFirst((q) =>
    q.where({ target: 'signup-new@vers.test', type: 'onboarding' }),
  );

  expect(verification).toBeDefined();

  const welcomeEmail = db.sentEmailCollection.findFirst((q) =>
    q.where({ payload: { to: 'signup-new@vers.test' }, template: 'send-welcome' }),
  );

  expect(welcomeEmail?.payload).toStrictEqual({
    to: 'signup-new@vers.test',
    verificationCode: verification?.code ?? '',
    verificationURL: `http://localhost/verify-otp?${new URLSearchParams({ code: verification?.code ?? '', target: 'signup-new@vers.test', type: 'onboarding' }).toString()}`,
  });
});
