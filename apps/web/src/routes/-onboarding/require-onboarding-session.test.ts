import { expect, test } from 'bun:test';
import { withRequestContext } from '../../test-utils/with-request-context';
import { requireOnboardingSession } from './require-onboarding-session';

test('it returns the pending onboarding email', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'pending@vers.test' } } },
    () => requireOnboardingSession(),
  );

  expect(outcome.value).toStrictEqual({ email: 'pending@vers.test' });
});

test('it redirects to signup with no reason when the session is missing', () => {
  const promise = withRequestContext({}, () => requireOnboardingSession());

  expect(promise).rejects.toMatchObject({ options: { href: '/signup' } });
});

test('it redirects to signup with the given reason when the session is missing', () => {
  const promise = withRequestContext({}, () =>
    requireOnboardingSession({ missingSessionReason: 'verification-lapsed' }),
  );

  expect(promise).rejects.toMatchObject({
    options: { href: '/signup?reason=verification-lapsed' },
  });
});

test('it redirects home for a signed-in caller before reading the onboarding session', () => {
  const promise = withRequestContext(
    {
      cookies: {
        en_session: { sessionID: 'session-1' },
        en_verification: { 'onboarding#email': 'pending@vers.test' },
      },
    },
    () => requireOnboardingSession(),
  );

  expect(promise).rejects.toMatchObject({ options: { href: '/' } });
});
