import { drop } from '@mswjs/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { composeDataFnWrappers } from '../../test-utils/compose-data-fn-wrappers';
import { withAppLoadContext } from '../../test-utils/with-app-load-context';
import { withAuthedUser } from '../../test-utils/with-authed-user';
import { withRouteProps } from '../../test-utils/with-route-props';
import { withSession } from '../../test-utils/with-session';
import { Routes } from '../../types';
import { Onboarding, action, loader } from './route';

interface TestConfig {
  email?: string;
  isAuthed: boolean;
  isOnboarding: boolean;
  transactionToken?: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
function setupTest(config: TestConfig) {
  const user = userEvent.setup();

  const email = typeof config.email === 'string' ? config.email : 'user@test.com';

  const transactionToken =
    typeof config.transactionToken === 'string' ? config.transactionToken : '1234567890';

  const _loader = composeDataFnWrappers(
    loader,
    withAppLoadContext,
    config.isAuthed && withAuthedUser,
    config.isOnboarding &&
      ((_) =>
        withSession(_, {
          'onboarding#email': email,
          'onboarding#transactionToken': transactionToken,
        })),
  );

  const _action = composeDataFnWrappers(
    action,
    withAppLoadContext,
    config.isAuthed && withAuthedUser,
    config.isOnboarding &&
      ((_) =>
        withSession(_, {
          'onboarding#email': email,
          'onboarding#transactionToken': transactionToken,
        })),
  );

  const OnboardingStub = createRoutesStub([
    {
      action: _action,
      Component: withRouteProps(Onboarding),
      loader: _loader,
      path: '/',
    },
    {
      Component: () => 'NEXUS_ROUTE',
      path: Routes.Nexus,
    },
    {
      Component: () => 'SIGNUP_ROUTE',
      path: Routes.Signup,
    },
  ]);

  render(<OnboardingStub />);

  return { user };
}

afterEach(() => {
  drop(db);
});

test('it redirects to the signup route when no email is stored in the verification session', async () => {
  setupTest({
    email: '',
    isAuthed: false,
    isOnboarding: false,
  });

  const signupRoute = await screen.findByText('SIGNUP_ROUTE');

  expect(signupRoute).toBeInTheDocument();
});

test('it redirects to the signup route when no transaction token is stored in the verification session', async () => {
  setupTest({
    isAuthed: false,
    isOnboarding: false,
    transactionToken: '',
  });

  const signupRoute = await screen.findByText('SIGNUP_ROUTE');

  expect(signupRoute).toBeInTheDocument();
});

test('it redirects to the nexus route when authenticated', async () => {
  setupTest({ isAuthed: true, isOnboarding: true });

  const nexusRoute = await screen.findByText('NEXUS_ROUTE');

  expect(nexusRoute).toBeInTheDocument();
});

test('it renders the onboarding form', async () => {
  setupTest({ isAuthed: false, isOnboarding: true });

  const usernameInput = await screen.findByLabelText('Username');
  const nameInput = screen.getByLabelText('Name');
  const passwordInput = screen.getByLabelText('Password');
  const confirmPasswordInput = screen.getByLabelText('Confirm Password');

  const agreeToTermsCheckbox = screen.getByRole('checkbox', {
    name: 'Agree to terms',
  });

  const rememberMeCheckbox = screen.getByRole('checkbox', {
    name: 'Remember me',
  });

  const submitButton = screen.getByRole('button', {
    name: 'Create an Account',
  });

  expect(usernameInput).toBeInTheDocument();
  expect(nameInput).toBeInTheDocument();
  expect(passwordInput).toBeInTheDocument();
  expect(confirmPasswordInput).toBeInTheDocument();
  expect(agreeToTermsCheckbox).toBeInTheDocument();
  expect(rememberMeCheckbox).toBeInTheDocument();
  expect(submitButton).toBeInTheDocument();
});

test('it shows validation errors for missing required fields', async () => {
  const { user } = setupTest({ isAuthed: false, isOnboarding: true });

  const createAccountButton = await screen.findByRole('button', {
    name: 'Create an Account',
  });

  await user.click(createAccountButton);

  const usernameError = await screen.findByText('Username is required');
  const nameError = screen.getByText('Name is required');
  const passwordErrors = screen.getAllByText('Password is required');

  const agreeToTermsError = screen.getByText(
    'You must agree to the terms of service and privacy policy',
  );

  expect(usernameError).toBeInTheDocument();
  expect(nameError).toBeInTheDocument();
  expect(passwordErrors).toHaveLength(2);
  expect(agreeToTermsError).toBeInTheDocument();
});

test('it shows validation error for mismatched passwords', async () => {
  const { user } = setupTest({ isAuthed: false, isOnboarding: true });

  const passwordInput = await screen.findByLabelText('Password');
  const confirmPasswordInput = screen.getByLabelText('Confirm Password');

  const createAccountButton = screen.getByRole('button', {
    name: 'Create an Account',
  });

  await user.type(passwordInput, 'password123');
  await user.type(confirmPasswordInput, 'password456');
  await user.click(createAccountButton);

  const passwordError = await screen.findByText('The passwords must match');

  expect(passwordError).toBeInTheDocument();
});

test('it redirects to the nexus on successful account creation', async () => {
  const { user } = setupTest({ isAuthed: false, isOnboarding: true });

  const usernameInput = await screen.findByLabelText('Username');
  const nameInput = screen.getByLabelText('Name');
  const passwordInput = screen.getByLabelText('Password');
  const confirmPasswordInput = screen.getByLabelText('Confirm Password');

  const createAccountButton = screen.getByRole('button', {
    name: 'Create an Account',
  });

  const agreeToTermsCheckbox = screen.getByRole('checkbox', {
    name: 'Agree to terms',
  });

  await user.type(usernameInput, 'testuser');
  await user.type(nameInput, 'Test User');
  await user.type(passwordInput, 'password123');
  await user.type(confirmPasswordInput, 'password123');
  await user.click(agreeToTermsCheckbox);
  await user.click(createAccountButton);

  const nexusRoute = await screen.findByText('NEXUS_ROUTE');

  expect(nexusRoute).toBeInTheDocument();
});
