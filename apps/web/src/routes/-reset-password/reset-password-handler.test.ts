import { expect, test } from 'bun:test';
import * as db from '@vers/mock-services/db';
import invariant from 'tiny-invariant';
import { HONEYPOT_FIELD_NAME } from '../../lib/auth/honeypot-field-names';
import { buildFormData } from '../../test-utils/build-form-data';
import { withRequestContext } from '../../test-utils/with-request-context';
import { resetPasswordHandler } from './reset-password-handler';

test('it redirects home for an already signed-in caller', () => {
  const promise = withRequestContext({ cookies: { en_session: { sessionID: 'session-1' } } }, () =>
    resetPasswordHandler(
      buildFormData({
        confirmPassword: 'new-password123',
        email: 'reset-password@vers.test',
        password: 'new-password123',
        resetToken: 'a-reset-token',
      }),
    ),
  );

  expect(promise).rejects.toMatchObject({ options: { href: '/' } });
});

test('it rejects a submission with a filled-in honeypot field', async () => {
  const formData = buildFormData({
    confirmPassword: 'new-password123',
    email: 'reset-password@vers.test',
    password: 'new-password123',
    resetToken: 'a-reset-token',
  });

  formData.set(HONEYPOT_FIELD_NAME, 'filled in by a bot');

  const outcome = await withRequestContext({}, () => resetPasswordHandler(formData));

  invariant(outcome.value instanceof Response, 'expected a Response');

  expect(outcome.value.status).toBe(400);
});

test('it reports a field error for a mismatched password confirmation', async () => {
  const outcome = await withRequestContext({}, () =>
    resetPasswordHandler(
      buildFormData({
        confirmPassword: 'not-the-same-password',
        email: 'reset-password@vers.test',
        password: 'new-password123',
        resetToken: 'a-reset-token',
      }),
    ),
  );

  invariant(!(outcome.value instanceof Response), 'expected a submission result');

  expect(outcome.value.error).toStrictEqual({ confirmPassword: ['The passwords must match'] });
});

test('it reports a form error for an email with no matching account', async () => {
  const outcome = await withRequestContext({}, () =>
    resetPasswordHandler(
      buildFormData({
        confirmPassword: 'new-password123',
        email: 'reset-password@vers.test',
        password: 'new-password123',
        resetToken: 'a-reset-token',
      }),
    ),
  );

  invariant(!(outcome.value instanceof Response), 'expected a submission result');

  expect(outcome.value.error).toStrictEqual({
    '': ['This reset link is invalid or has expired.'],
  });
});

test('it reports a form error for a stale or invalid reset token', async () => {
  await db.userCollection.create({ email: 'reset-password-bad-token@vers.test' });

  const outcome = await withRequestContext({}, () =>
    resetPasswordHandler(
      buildFormData({
        confirmPassword: 'new-password123',
        email: 'reset-password-bad-token@vers.test',
        password: 'new-password123',
        resetToken: 'the-wrong-token',
      }),
    ),
  );

  invariant(!(outcome.value instanceof Response), 'expected a submission result');

  expect(outcome.value.error).toStrictEqual({
    '': ['This reset link is invalid or has expired.'],
  });

  expect(
    db.sentEmailCollection.findFirst((q) =>
      q.where({
        payload: { to: 'reset-password-bad-token@vers.test' },
        template: 'send-password-changed',
      }),
    ),
  ).toBeUndefined();
});

test('it resets the password, signs the caller out everywhere, and redirects to login', async () => {
  const user = await db.userCollection.create({
    email: 'reset-password-success@vers.test',
    passwordResetToken: 'the-right-token',
  });

  await db.sessionCollection.create({ userID: user.id });

  const promise = withRequestContext({}, () =>
    resetPasswordHandler(
      buildFormData({
        confirmPassword: 'new-password123',
        email: 'reset-password-success@vers.test',
        password: 'new-password123',
        resetToken: 'the-right-token',
      }),
    ),
  );

  // the db reads below must observe the rejected call's password-reset side effects settled
  await promise.catch(() => {});

  expect(promise).rejects.toMatchObject({ options: { href: '/login' } });

  const updated = db.userCollection.findFirst((q) => q.where({ id: user.id }));

  expect(updated?.password).toBe('new-password123');
  expect(updated?.passwordResetToken).toBeNull();

  const remainingSessions = db.sessionCollection.findMany((q) => q.where({ userID: user.id }));

  expect(remainingSessions).toStrictEqual([]);

  const passwordChangedEmail = db.sentEmailCollection.findFirst((q) =>
    q.where({
      payload: { to: 'reset-password-success@vers.test' },
      template: 'send-password-changed',
    }),
  );

  expect(passwordChangedEmail?.payload).toStrictEqual({
    email: 'reset-password-success@vers.test',
    to: 'reset-password-success@vers.test',
  });
});
