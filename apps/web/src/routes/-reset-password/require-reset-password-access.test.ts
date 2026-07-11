import { expect, test } from 'bun:test';
import { withRequestContext } from '../../test-utils/with-request-context';
import { requireResetPasswordAccess } from './require-reset-password-access';

test('it redirects home for an already signed-in caller', () => {
  const promise = withRequestContext({ cookies: { en_session: { sessionID: 'session-1' } } }, () =>
    requireResetPasswordAccess({ email: 'x@vers.test', token: 'a-token' }),
  );

  expect(promise).rejects.toMatchObject({ options: { href: '/' } });
});

test('it redirects to login when the email query param is missing', () => {
  const promise = withRequestContext({}, () => requireResetPasswordAccess({ token: 'a-token' }));

  expect(promise).rejects.toMatchObject({ options: { href: '/login' } });
});

test('it redirects to login when the token query param is missing', () => {
  const promise = withRequestContext({}, () =>
    requireResetPasswordAccess({ email: 'x@vers.test' }),
  );

  expect(promise).rejects.toMatchObject({ options: { href: '/login' } });
});

test('it returns the email and reset token from the query params', async () => {
  const outcome = await withRequestContext({}, () =>
    requireResetPasswordAccess({ email: 'x@vers.test', token: 'a-token' }),
  );

  expect(outcome.value).toStrictEqual({ email: 'x@vers.test', resetToken: 'a-token' });
});
