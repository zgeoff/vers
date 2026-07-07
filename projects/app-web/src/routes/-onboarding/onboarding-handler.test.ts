import { expect, test } from 'bun:test';
import { isRedirect } from '@tanstack/react-router';
import { userCollection } from '../../../mocks/db/user-collection';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { HONEYPOT_FIELD_NAME } from '../../lib/auth/honeypot-field-names';
import { onboardingHandler } from './onboarding-handler';

function buildOnboardingFormData(fields: Readonly<Record<string, string>>): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return formData;
}

const validFields = {
  agreeToTerms: 'on',
  confirmPassword: 'password123',
  name: 'John Smith',
  password: 'password123',
  username: 'john_smith13',
};

test('it redirects to signup when there is no pending onboarding session', () => {
  const promise = withRequestContext({}, () =>
    onboardingHandler(buildOnboardingFormData(validFields)),
  );

  expect(promise).rejects.toMatchObject({ options: { href: '/signup' } });
});

test('it rejects a submission with a filled-in honeypot field', async () => {
  const formData = buildOnboardingFormData(validFields);

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
        buildOnboardingFormData({ ...validFields, confirmPassword: 'not-the-same-password' }),
      ),
  );

  expect(outcome.value).toStrictEqual({
    fieldErrors: { confirmPassword: 'The passwords must match' },
    status: 'invalid-fields',
  });
});

test('it reports a field error for a username already in use', async () => {
  await userCollection.create({
    createdAt: new Date(),
    email: 'onboard-username-taken-existing@vers.test',
    id: 'onboard-username-taken-existing',
    name: 'Existing User',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: 'john_smith13',
  });

  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboard-username-taken@vers.test' } } },
    () => onboardingHandler(buildOnboardingFormData(validFields)),
  );

  expect(outcome.value).toStrictEqual({
    fieldErrors: { username: 'A user with that username already exists' },
    status: 'invalid-fields',
  });
});

test('it creates the account, signs the caller in, and clears the onboarding session', async () => {
  const outcome = await withRequestContext(
    { cookies: { en_verification: { 'onboarding#email': 'onboard-success@vers.test' } } },
    async () => {
      const redirectHref = await onboardingHandler(
        buildOnboardingFormData({ ...validFields, username: 'onboard_success_user' }),
      )
        .then(() => null)
        .catch((error: unknown) => (isRedirect(error) ? error.options.href : null));

      return redirectHref;
    },
  );

  expect(outcome.value).toBe('/');
  expect(outcome.cookies['en_session']).toContainKeys(['accessToken', 'refreshToken', 'sessionID']);
  expect(outcome.cookies['en_verification']).toStrictEqual({});

  const created = userCollection.findFirst((q) => q.where({ email: 'onboard-success@vers.test' }));

  expect(created?.username).toBe('onboard_success_user');
});
