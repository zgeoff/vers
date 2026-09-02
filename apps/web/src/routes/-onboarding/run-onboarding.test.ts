import { expect, test } from 'bun:test';
import { buildContractMock } from '@vers/client-test-utils/orpc';
import { userContract } from '@vers/contract-user';
import * as db from '@vers/mock-services/db';
import invariant from 'tiny-invariant';
import { HONEYPOT_FIELD_NAME } from '../../lib/auth/honeypot-field-names';
import { SERVICE_URLS } from '../../lib/rpc/service-urls';
import { server } from '../../mocks/node';
import { buildFormData } from '../../test-utils/build-form-data';
import { withRequestContext } from '../../test-utils/with-request-context';
import { runOnboarding } from './run-onboarding';

test('it redirects to signup when there is no pending onboarding session', () => {
  const promise = withRequestContext({}, () =>
    runOnboarding(
      buildFormData({
        agreeToTerms: 'on',
        confirmPassword: 'password123',
        name: 'John Smith',
        password: 'password123',
        username: 'john_smith13',
      }),
    ),
  );

  expect(promise).rejects.toMatchObject({ options: { href: '/signup' } });
});

test('it rejects a submission with a filled-in honeypot field', async () => {
  const formData = buildFormData({
    agreeToTerms: 'on',
    confirmPassword: 'password123',
    name: 'John Smith',
    password: 'password123',
    username: 'john_smith13',
  });

  formData.set(HONEYPOT_FIELD_NAME, 'filled in by a bot');

  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboard-honeypot@vers.test' } } },
    () => runOnboarding(formData),
  );

  invariant(outcome.value instanceof Response, 'expected a Response');

  expect(outcome.value.status).toBe(400);
});

test('it reports field errors for a mismatched password confirmation', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboard-mismatch@vers.test' } } },
    () =>
      runOnboarding(
        buildFormData({
          agreeToTerms: 'on',
          confirmPassword: 'not-the-same-password',
          name: 'John Smith',
          password: 'password123',
          username: 'john_smith13',
        }),
      ),
  );

  invariant(!(outcome.value instanceof Response), 'expected a submission result');

  expect(outcome.value.error).toStrictEqual({ confirmPassword: ['The passwords must match'] });
});

test('it reports a field error for a username already in use', async () => {
  await db.userCollection.create({ username: 'john_smith13' });

  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboard-username-taken@vers.test' } } },
    () =>
      runOnboarding(
        buildFormData({
          agreeToTerms: 'on',
          confirmPassword: 'password123',
          name: 'John Smith',
          password: 'password123',
          username: 'john_smith13',
        }),
      ),
  );

  invariant(!(outcome.value instanceof Response), 'expected a submission result');

  expect(outcome.value.error).toStrictEqual({
    username: ['A user with that username already exists'],
  });
});

test('it reports a generic form-level error when account creation fails', async () => {
  const mockUser = buildContractMock({
    baseUrl: SERVICE_URLS.user,
    contract: userContract,
    resolveContext: () => ({ actingUserID: null }),
  });

  server.use(
    mockUser.createUser.handler(() => {
      throw new Error('the user service is unreachable');
    }),
  );

  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboard-failure@vers.test' } } },
    () =>
      runOnboarding(
        buildFormData({
          agreeToTerms: 'on',
          confirmPassword: 'password123',
          name: 'John Smith',
          password: 'password123',
          username: 'onboard_failure_user',
        }),
      ),
  );

  invariant(!(outcome.value instanceof Response), 'expected a submission result');

  expect(outcome.value.error).toStrictEqual({ '': ['Something went wrong. Please try again.'] });
});

test('it creates the account, signs the caller in, and clears the onboarding session', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboard-success@vers.test' } } },
    async () => {
      const promise = runOnboarding(
        buildFormData({
          agreeToTerms: 'on',
          confirmPassword: 'password123',
          name: 'John Smith',
          password: 'password123',
          username: 'onboard_success_user',
        }),
      );

      // the outer cookie/db reads must observe the rejected call's account-creation settled
      await promise.catch(() => {});

      expect(promise).rejects.toMatchObject({ options: { href: '/respite' } });
    },
  );

  expect(outcome.cookies['en_session']).toContainKeys(['accessToken', 'refreshToken', 'sessionID']);
  expect(outcome.cookies['en_verification']).toStrictEqual({});

  const created = db.userCollection.findFirst((q) =>
    q.where({ email: 'onboard-success@vers.test' }),
  );

  expect(created?.username).toBe('onboard_success_user');
});
