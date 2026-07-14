import { expect, test } from 'bun:test';
import { isRedirect } from '@tanstack/react-router';
import * as db from '@vers/mock-services/db';
import { HONEYPOT_FIELD_NAME } from '../../lib/auth/honeypot-field-names';
import { buildFormData } from '../../test-utils/build-form-data';
import { withRequestContext } from '../../test-utils/with-request-context';
import { forgotPasswordHandler } from './forgot-password-handler';

test('it redirects home for an already signed-in caller', () => {
  const promise = withRequestContext({ cookies: { en_session: { sessionID: 'session-1' } } }, () =>
    forgotPasswordHandler(buildFormData({ email: 'x@vers.test' })),
  );

  expect(promise).rejects.toMatchObject({ options: { href: '/' } });
});

test('it rejects a submission with a filled-in honeypot field', async () => {
  const formData = buildFormData({ email: 'x@vers.test' });

  formData.set(HONEYPOT_FIELD_NAME, 'filled in by a bot');

  const outcome = await withRequestContext({}, () => forgotPasswordHandler(formData));

  if (!(outcome.value instanceof Response)) {
    throw new Error('expected a Response');
  }

  expect(outcome.value.status).toBe(400);
});

test('it reports a field error for an invalid email', async () => {
  const outcome = await withRequestContext({}, () =>
    forgotPasswordHandler(buildFormData({ email: 'not-an-email' })),
  );

  if (outcome.value instanceof Response) {
    throw new TypeError('expected a submission result');
  }

  expect(outcome.value.error).toStrictEqual({ email: ['Email is invalid'] });
});

test('it mints a reset token for a matching account and redirects', async () => {
  const user = await db.userCollection.create({ email: 'forgot-password-existing@vers.test' });

  const outcome = await withRequestContext({}, async () => {
    const redirectHref = await forgotPasswordHandler(
      buildFormData({ email: 'forgot-password-existing@vers.test' }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/reset-password-started');

  const updated = db.userCollection.findFirst((q) => q.where({ id: user.id }));

  expect(updated?.passwordResetToken).toBeString();

  const resetPasswordEmail = db.sentEmailCollection.findFirst((q) =>
    q.where({
      payload: { to: 'forgot-password-existing@vers.test' },
      template: 'send-reset-password',
    }),
  );

  expect(resetPasswordEmail?.payload).toStrictEqual({
    resetURL: `http://localhost/reset-password?${new URLSearchParams({ email: 'forgot-password-existing@vers.test', token: updated?.passwordResetToken ?? '' }).toString()}`,
    to: 'forgot-password-existing@vers.test',
  });
});

test('it redirects the same way for an email with no matching account', async () => {
  const outcome = await withRequestContext({}, async () => {
    const redirectHref = await forgotPasswordHandler(
      buildFormData({ email: 'forgot-password-unknown@vers.test' }),
    )
      .then(() => null)
      .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

    return redirectHref;
  });

  expect(outcome.value).toBe('/reset-password-started');

  expect(
    db.sentEmailCollection.findFirst((q) =>
      q.where({
        payload: { to: 'forgot-password-unknown@vers.test' },
        template: 'send-reset-password',
      }),
    ),
  ).toBeUndefined();
});
