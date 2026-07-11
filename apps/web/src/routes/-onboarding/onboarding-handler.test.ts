import { expect, test } from 'bun:test';
import { isRedirect } from '@tanstack/react-router';
import { buildContractMock } from '@vers/client-test-utils/orpc';
import { userContract } from '@vers/contract-user';
import { HONEYPOT_FIELD_NAME } from '../../lib/auth/honeypot-field-names';
import { SERVICE_URLS } from '../../lib/rpc/service-urls';
import * as db from '../../mocks/db';
import { server } from '../../mocks/node';
import { buildFormData } from '../../test-utils/build-form-data';
import { withRequestContext } from '../../test-utils/with-request-context';
import { onboardingHandler } from './onboarding-handler';

const validFields = {
  agreeToTerms: 'on',
  confirmPassword: 'password123',
  name: 'John Smith',
  password: 'password123',
  username: 'john_smith13',
};

test('it redirects to signup when there is no pending onboarding session', () => {
  const promise = withRequestContext({}, () => onboardingHandler(buildFormData(validFields)));

  expect(promise).rejects.toMatchObject({ options: { href: '/signup' } });
});

test('it rejects a submission with a filled-in honeypot field', async () => {
  const formData = buildFormData(validFields);

  formData.set(HONEYPOT_FIELD_NAME, 'filled in by a bot');

  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboard-honeypot@vers.test' } } },
    () => onboardingHandler(formData),
  );

  if (!(outcome.value instanceof Response)) {
    throw new Error('expected a Response');
  }

  expect(outcome.value.status).toBe(400);
});

test('it reports field errors for a mismatched password confirmation', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboard-mismatch@vers.test' } } },
    () =>
      onboardingHandler(
        buildFormData({ ...validFields, confirmPassword: 'not-the-same-password' }),
      ),
  );

  if (outcome.value instanceof Response) {
    throw new TypeError('expected a submission result');
  }

  expect(outcome.value.error).toStrictEqual({ confirmPassword: ['The passwords must match'] });
});

test('it reports a field error for a username already in use', async () => {
  await db.userCollection.create({ username: 'john_smith13' });

  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboard-username-taken@vers.test' } } },
    () => onboardingHandler(buildFormData(validFields)),
  );

  if (outcome.value instanceof Response) {
    throw new TypeError('expected a submission result');
  }

  expect(outcome.value.error).toStrictEqual({
    username: ['A user with that username already exists'],
  });
});

test('it reports a generic form-level error when account creation fails', async () => {
  const mockUser = buildContractMock({
    baseUrl: SERVICE_URLS.user,
    contract: userContract,
    resolveContext: () => ({ actingUserId: null }),
  });

  server.use(
    mockUser.createUser.handler(() => {
      throw new Error('the user service is unreachable');
    }),
  );

  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboard-failure@vers.test' } } },
    () => onboardingHandler(buildFormData({ ...validFields, username: 'onboard_failure_user' })),
  );

  if (outcome.value instanceof Response) {
    throw new TypeError('expected a submission result');
  }

  expect(outcome.value.error).toStrictEqual({ '': ['Something went wrong. Please try again.'] });
});

test('it creates the account, signs the caller in, and clears the onboarding session', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboard-success@vers.test' } } },
    async () => {
      const redirectHref = await onboardingHandler(
        buildFormData({ ...validFields, username: 'onboard_success_user' }),
      )
        .then(() => null)
        .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

      return redirectHref;
    },
  );

  expect(outcome.value).toBe('/respite');
  expect(outcome.cookies['en_session']).toContainKeys(['accessToken', 'refreshToken', 'sessionID']);
  expect(outcome.cookies['en_verification']).toStrictEqual({});

  const created = db.userCollection.findFirst((q) =>
    q.where({ email: 'onboard-success@vers.test' }),
  );

  expect(created?.username).toBe('onboard_success_user');
});
