import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { isRedirect } from '@tanstack/react-router';
import { userCollection } from '../../../mocks/db/user-collection';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { HONEYPOT_FIELD_NAME } from '../../lib/auth/honeypot-field-names';
import { forgotPasswordHandler } from './forgot-password-handler';

function buildForgotPasswordFormData(fields: Readonly<Record<string, string>>): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return formData;
}

test('it redirects home for an already signed-in caller', () => {
  const promise = withRequestContext({ cookies: { en_session: { sessionID: 'session-1' } } }, () =>
    forgotPasswordHandler(buildForgotPasswordFormData({ email: 'x@vers.test' })),
  );

  expect(promise).rejects.toMatchObject({ options: { href: '/' } });
});

test('it rejects a submission with a filled-in honeypot field', async () => {
  const formData = buildForgotPasswordFormData({ email: 'x@vers.test' });

  formData.set(HONEYPOT_FIELD_NAME, 'filled in by a bot');

  const outcome = await withRequestContext({}, () => forgotPasswordHandler(formData));

  if (!(outcome.value instanceof Response)) {
    throw new Error('expected a Response');
  }

  expect(outcome.value.status).toBe(400);
});

test('it reports a field error for an invalid email', async () => {
  const outcome = await withRequestContext({}, () =>
    forgotPasswordHandler(buildForgotPasswordFormData({ email: 'not-an-email' })),
  );

  expect(outcome.value).toStrictEqual({
    fieldErrors: { email: 'Email is invalid' },
    status: 'invalid-fields',
  });
});

test('it mints a reset token for a matching account and redirects', async () => {
  const user = await userCollection.create({
    createdAt: new Date(),
    email: 'forgot-password-existing@vers.test',
    id: createId(),
    name: 'Forgot Password Existing',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: 'forgot-password-existing',
  });

  const outcome = await withRequestContext({}, async () => {
    const redirectHref = await forgotPasswordHandler(
      buildForgotPasswordFormData({ email: 'forgot-password-existing@vers.test' }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/reset-password-started');

  const updated = userCollection.findFirst((q) => q.where({ id: user.id }));

  expect(updated?.passwordResetToken).toBeString();
});

test('it redirects the same way for an email with no matching account', async () => {
  const outcome = await withRequestContext({}, async () => {
    const redirectHref = await forgotPasswordHandler(
      buildForgotPasswordFormData({ email: 'forgot-password-unknown@vers.test' }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/reset-password-started');
});
