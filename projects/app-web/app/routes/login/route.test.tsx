import { drop } from '@mswjs/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphQLError } from 'graphql';
import { graphql } from 'msw';
import { createRoutesStub } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';
import { db } from '../../mocks/db';
import { server } from '../../mocks/node';
import { verifySessionStorage } from '../../session/verify-session-storage.server';
import { composeDataFnWrappers } from '../../test-utils/compose-data-fn-wrappers';
import { withAppLoadContext } from '../../test-utils/with-app-load-context';
import { withAuthedUser } from '../../test-utils/with-authed-user';
import { withRouteProps } from '../../test-utils/with-route-props';
import { Routes } from '../../types';
import { Login, action, loader } from './route';

let setCookieHeader: null | string = null;

const _Response = globalThis.Response;

// stub the global Response object so we can capture the cookie header
vi.stubGlobal(
  'Response',
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  vi.fn((body?: BodyInit | null, init?: ResponseInit) => {
    if (init?.headers instanceof Headers) {
      setCookieHeader = init.headers.get('set-cookie');
    }

    return new _Response(body, init);
  }),
);

interface TestConfig {
  initialPath?: string;
  isAuthed: boolean;
  user?: {
    email?: string;
    password?: string;
  };
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
function setupTest(config: TestConfig) {
  const initialPath = config.initialPath ?? '/';
  const user = userEvent.setup();

  const _action = composeDataFnWrappers(
    action,
    withAppLoadContext,
    config.isAuthed && ((_) => withAuthedUser(_, { user: config.user })),
  );

  const _loader = composeDataFnWrappers(
    loader,
    withAppLoadContext,
    config.isAuthed && ((_) => withAuthedUser(_, { user: config.user })),
  );

  const LoginStub = createRoutesStub([
    {
      action: _action,
      Component: withRouteProps(Login),
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
    {
      Component: () => 'CUSTOM_REDIRECT_ROUTE',
      path: '/custom-redirect-route',
    },
    {
      Component: () => 'VERIFY_OTP_ROUTE',
      path: Routes.VerifyOTP,
    },
    {
      Component: () => 'FORCE_LOGOUT_ROUTE',
      path: Routes.LoginForceLogout,
    },
  ]);

  render(<LoginStub initialEntries={[initialPath]} />);

  return { user };
}

afterEach(() => {
  server.resetHandlers();

  drop(db);

  setCookieHeader = null;
});

test('it renders the login form', async () => {
  setupTest({ isAuthed: false });

  const emailInput = await screen.findByLabelText('Email');
  const passwordInput = screen.getByLabelText('Password');
  const submitButton = screen.getByRole('button', { name: 'Login' });

  const rememberMeCheckbox = screen.getByRole('checkbox', {
    name: 'Remember me',
  });

  expect(emailInput).toBeInTheDocument();
  expect(passwordInput).toBeInTheDocument();
  expect(rememberMeCheckbox).toBeInTheDocument();
  expect(submitButton).toBeInTheDocument();
});

test('it shows validation errors for an invalid email', async () => {
  const setup = setupTest({ isAuthed: false });

  const emailInput = await screen.findByLabelText('Email');
  const submitButton = screen.getByRole('button', { name: 'Login' });

  await setup.user.type(emailInput, 'invalid-email');
  await setup.user.click(submitButton);

  const error = await screen.findByText('Email is invalid');

  expect(error).toBeInTheDocument();
});

test('it shows validation errors for a short password', async () => {
  const setup = setupTest({ isAuthed: false });

  const passwordInput = await screen.findByLabelText('Password');
  const submitButton = screen.getByRole('button', { name: 'Login' });

  await setup.user.type(passwordInput, 'short');
  await setup.user.click(submitButton);

  const error = await screen.findByText('Password must be 8+ characters');

  expect(error).toBeInTheDocument();
});

test('it navigates to signup page when clicking the signup link', async () => {
  const setup = setupTest({ isAuthed: false });

  const signupLink = await screen.findByRole('link', { name: 'Signup' });

  await setup.user.click(signupLink);

  const signupRoute = await screen.findByText('SIGNUP_ROUTE');

  expect(signupRoute).toBeInTheDocument();
});

test('it redirects to the nexus on successful login', async () => {
  db.user.create({
    email: 'test@example.com',
    password: 'password123',
  });

  const setup = setupTest({ isAuthed: false });

  const emailInput = await screen.findByLabelText('Email');
  const passwordInput = screen.getByLabelText('Password');
  const submitButton = screen.getByRole('button', { name: 'Login' });

  await setup.user.type(emailInput, 'test@example.com');
  await setup.user.type(passwordInput, 'password123');
  await setup.user.click(submitButton);

  const nexusRoute = await screen.findByText('NEXUS_ROUTE');

  expect(nexusRoute).toBeInTheDocument();
});

test('it redirects to verify-otp when 2FA is required', async () => {
  db.user.create({
    email: 'test@example.com',
    password: 'password123',
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa',
  });

  const setup = setupTest({ isAuthed: false });

  const emailInput = await screen.findByLabelText('Email');
  const passwordInput = screen.getByLabelText('Password');
  const submitButton = screen.getByRole('button', { name: 'Login' });

  await setup.user.type(emailInput, 'test@example.com');
  await setup.user.type(passwordInput, 'password123');
  await setup.user.click(submitButton);

  const verifyOtpRoute = await screen.findByText('VERIFY_OTP_ROUTE');

  expect(verifyOtpRoute).toBeInTheDocument();

  const verifySession = await verifySessionStorage.getSession(setCookieHeader);

  expect(verifySession.get('login2FA#transactionID')).toBe('transaction_id');
  expect(verifySession.get('login2FA#sessionID')).toStrictEqual(expect.any(String));
});

test('it redirects to the force logout sessions route when a previous session exists', async () => {
  db.user.create({
    email: 'test@example.com',
    id: 'user_id',
    password: 'password123',
  });

  db.session.create({
    userID: 'user_id',
  });

  const setup = setupTest({ isAuthed: false });

  const emailInput = await screen.findByLabelText('Email');
  const passwordInput = screen.getByLabelText('Password');
  const submitButton = screen.getByRole('button', { name: 'Login' });

  await setup.user.type(emailInput, 'test@example.com');
  await setup.user.type(passwordInput, 'password123');
  await setup.user.click(submitButton);

  const forceLogoutRoute = await screen.findByText('FORCE_LOGOUT_ROUTE');

  expect(forceLogoutRoute).toBeInTheDocument();

  const verifySession = await verifySessionStorage.getSession(setCookieHeader);

  expect(verifySession.get('loginLogout#email')).toBe('test@example.com');
  expect(verifySession.get('loginLogout#transactionToken')).toBe('valid_transaction_token');
});

test('it redirects to the specified route when provided', async () => {
  db.user.create({
    email: 'test@example.com',
    password: 'password123',
  });

  const setup = setupTest({
    initialPath: '/?redirect=/custom-redirect-route',
    isAuthed: false,
  });

  const emailInput = await screen.findByLabelText('Email');
  const passwordInput = screen.getByLabelText('Password');
  const submitButton = screen.getByRole('button', { name: 'Login' });

  await setup.user.type(emailInput, 'test@example.com');
  await setup.user.type(passwordInput, 'password123');
  await setup.user.click(submitButton);

  const redirectRoute = await screen.findByText('CUSTOM_REDIRECT_ROUTE');

  expect(redirectRoute).toBeInTheDocument();
});

test('it shows error message for invalid credentials', async () => {
  const setup = setupTest({ isAuthed: false });

  const emailInput = await screen.findByLabelText('Email');
  const passwordInput = screen.getByLabelText('Password');
  const submitButton = screen.getByRole('button', { name: 'Login' });

  await setup.user.type(emailInput, 'nonexistent@example.com');
  await setup.user.type(passwordInput, 'password123');
  await setup.user.click(submitButton);

  const error = await screen.findByText('Wrong email or password');

  expect(error).toBeInTheDocument();
});

test('it shows a generic error if the mutation fails', async () => {
  server.use(
    graphql.mutation('LoginWithPassword', () => {
      throw new GraphQLError('Something went wrong');
    }),
  );

  const setup = setupTest({ isAuthed: false });

  const emailInput = await screen.findByLabelText('Email');
  const passwordInput = screen.getByLabelText('Password');
  const submitButton = screen.getByRole('button', { name: 'Login' });

  await setup.user.type(emailInput, 'test@example.com');
  await setup.user.type(passwordInput, 'password123');
  await setup.user.click(submitButton);

  const error = await screen.findByText('Something went wrong');

  expect(error).toBeInTheDocument();
});

test('it redirects to the nexus route when already authenticated', async () => {
  setupTest({ isAuthed: true });

  const nexusRoute = await screen.findByText('NEXUS_ROUTE');

  expect(nexusRoute).toBeInTheDocument();
});
