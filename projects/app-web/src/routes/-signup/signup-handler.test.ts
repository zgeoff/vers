import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { isRedirect } from '@tanstack/react-router';
import { userCollection } from '../../../mocks/db/user-collection';
import { verificationCollection } from '../../../mocks/db/verification-collection';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { HONEYPOT_FIELD_NAME } from '../../lib/auth/honeypot-field-names';
import { signupHandler } from './signup-handler';

function buildSignupFormData(fields: Readonly<Record<string, string>>): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return formData;
}

test('it redirects home for an already signed-in caller', () => {
  const promise = withRequestContext({ cookies: { en_session: { sessionID: 'session-1' } } }, () =>
    signupHandler(buildSignupFormData({ email: 'x@vers.test' })),
  );

  expect(promise).rejects.toMatchObject({ options: { href: '/' } });
});

test('it rejects a submission with a filled-in honeypot field', async () => {
  const formData = buildSignupFormData({ email: 'x@vers.test' });

  formData.set(HONEYPOT_FIELD_NAME, 'filled in by a bot');

  const outcome = await withRequestContext({}, () => signupHandler(formData));

  if (!(outcome.value instanceof Response)) {
    throw new Error('expected a Response');
  }

  expect(outcome.value.status).toBe(400);
});

test('it reports a field error for an invalid email', async () => {
  const outcome = await withRequestContext({}, () =>
    signupHandler(buildSignupFormData({ email: 'not-an-email' })),
  );

  expect(outcome.value).toStrictEqual({
    fieldErrors: { email: 'Email is invalid' },
    status: 'invalid-fields',
  });
});

test('it reports a field error for an email already in use', async () => {
  await userCollection.create({
    createdAt: new Date(),
    email: 'signup-existing@vers.test',
    id: createId(),
    name: 'Signup Existing',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: 'signup-existing',
  });

  const outcome = await withRequestContext({}, () =>
    signupHandler(buildSignupFormData({ email: 'signup-existing@vers.test' })),
  );

  expect(outcome.value).toStrictEqual({
    fieldErrors: { email: 'An account with this email already exists' },
    status: 'invalid-fields',
  });
});

test('it creates an onboarding verification and redirects to verify-otp', async () => {
  const outcome = await withRequestContext({}, async () => {
    const redirectHref = await signupHandler(buildSignupFormData({ email: 'signup-new@vers.test' }))
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/verify-otp?target=signup-new%40vers.test&type=onboarding');

  const verification = verificationCollection.findFirst((q) =>
    q.where({ target: 'signup-new@vers.test', type: 'onboarding' }),
  );

  expect(verification).toBeDefined();
});
