import { drop } from '@mswjs/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphQLError } from 'graphql';
import { graphql } from 'msw';
import { createRoutesStub } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';
import { VerificationType } from '../../gql/graphql';
import { db } from '../../mocks/db';
import { server } from '../../mocks/node';
import type { SessionData } from '../../session/verify-session-storage.server';
import { verifySessionStorage } from '../../session/verify-session-storage.server';
import { composeDataFnWrappers } from '../../test-utils/compose-data-fn-wrappers';
import { withAppLoadContext } from '../../test-utils/with-app-load-context';
import { withAuthedUser } from '../../test-utils/with-authed-user';
import { withRouteProps } from '../../test-utils/with-route-props';
import { withSession } from '../../test-utils/with-session';
import { Routes } from '../../types';
import { VerifyOTPRoute, action, loader } from './route';

interface TestConfig {
  initialPath: string;
  isAuthed?: boolean;
  sessionData?: Partial<SessionData>;
  user?: {
    email?: string;
  };
}

let setCookieHeader: null | string = null;

const _Response = globalThis.Response;

// stub the global Response object so we can capture the cookie header
vi.stubGlobal(
  'Response',
  vi.fn((body?: BodyInit | null, init?: ResponseInit) => {
    if (init?.headers instanceof Headers) {
      setCookieHeader = init.headers.get('set-cookie');
    }

    return new _Response(body, init);
  }),
);

function setupTest(config: TestConfig) {
  const user = userEvent.setup();

  const _action = composeDataFnWrappers(
    action,
    withAppLoadContext,
    (_) => withSession(_, config.sessionData ?? {}),
    config.isAuthed && ((_) => withAuthedUser(_, { user: config.user })),
  );

  const VerifyOTPStub = createRoutesStub([
    {
      action: _action,
      Component: withRouteProps(VerifyOTPRoute),
      ErrorBoundary: () => 'ERROR_BOUNDARY',
      loader,
      path: Routes.VerifyOTP,
    },
    {
      Component: () => 'RESET_PASSWORD_ROUTE',
      path: Routes.ResetPassword,
    },
    {
      Component: () => 'ONBOARDING_ROUTE',
      path: Routes.Onboarding,
    },
    {
      Component: () => 'INDEX_ROUTE',
      path: Routes.Index,
    },
    {
      Component: () => 'NEXUS_ROUTE',
      path: Routes.Nexus,
    },
    {
      Component: () => 'ACCOUNT_ROUTE',
      path: Routes.Account,
    },
    {
      Component: () => 'CHANGE_PASSWORD_ROUTE',
      path: Routes.AccountChangePassword,
    },
    {
      Component: () => 'CHANGE_EMAIL_ROUTE',
      path: Routes.AccountChangeEmail,
    },
    {
      Component: () => 'FORCE_LOGOUT_ROUTE',
      path: Routes.LoginForceLogout,
    },
  ]);

  render(<VerifyOTPStub initialEntries={[config.initialPath]} />);

  return { user };
}

afterEach(() => {
  server.resetHandlers();

  drop(db);

  setCookieHeader = null;
});

test('it renders the verify OTP form with accessible elements', async () => {
  setupTest({
    initialPath: '/verify-otp?type=TWO_FACTOR_AUTH&target=test@example.com',
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: /verify/i });

  expect(codeInput).toBeInTheDocument();
  expect(submitButton).toBeInTheDocument();
});

test('it shows validation errors for invalid code', async () => {
  const { user } = setupTest({
    initialPath: '/verify-otp?type=TWO_FACTOR_AUTH&target=test@example.com',
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: /verify/i });

  await user.type(codeInput, '12345'); // Too short
  await user.click(submitButton);

  const errorText = await screen.findByText(/invalid code/i);

  expect(errorText).toBeInTheDocument();
});

test('it handles resetting password and redirects to the reset password route on success', async () => {
  const { user } = setupTest({
    initialPath:
      '/verify-otp?type=RESET_PASSWORD&target=test@example.com&redirect=/reset-password?token=test_reset_token',
    sessionData: {
      'resetPassword#transactionID': 'test_transaction_id',
    },
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa',
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: /verify/i });

  await user.type(codeInput, '999999');
  await user.click(submitButton);

  const resetPasswordRoute = await screen.findByText('RESET_PASSWORD_ROUTE');

  expect(resetPasswordRoute).toBeInTheDocument();

  const verifySession = await verifySessionStorage.getSession(setCookieHeader);

  expect(verifySession.get('resetPassword#transactionID')).toBeUndefined();
  expect(verifySession.get('resetPassword#transactionToken')).toBe('valid_transaction_token');
});

test('it handles onboarding and redirects to the onboarding route on success', async () => {
  const { user } = setupTest({
    initialPath: '/verify-otp?type=ONBOARDING&target=test@example.com',
    sessionData: {
      'onboarding#transactionID': 'test_transaction_id',
    },
  });

  db.verification.create({
    target: 'test@example.com',
    type: 'onboarding',
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: /verify/i });

  await user.type(codeInput, '999999');
  await user.click(submitButton);

  const onboardingRoute = await screen.findByText('ONBOARDING_ROUTE');

  expect(onboardingRoute).toBeInTheDocument();

  const verifySession = await verifySessionStorage.getSession(setCookieHeader);

  expect(verifySession.get('onboarding#email')).toBe('test@example.com');
  expect(verifySession.get('onboarding#transactionID')).toBeUndefined();
  expect(verifySession.get('onboarding#transactionToken')).toBe('valid_transaction_token');
});

test('it handles 2FA setup and throws an error', async () => {
  const { user } = setupTest({
    initialPath: '/verify-otp?type=TWO_FACTOR_AUTH_SETUP&target=test@example.com',
    sessionData: {
      'enable2FA#transactionID': 'test_transaction_id',
    },
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa-setup',
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: /verify/i });

  await user.type(codeInput, '999999');
  await user.click(submitButton);

  const errorBoundary = await screen.findByText(/ERROR_BOUNDARY/i);

  expect(errorBoundary).toBeInTheDocument();
});

test('it handles 2FA disabling and redirects to the account route on success', async () => {
  const { user } = setupTest({
    initialPath: '/verify-otp?type=TWO_FACTOR_AUTH_DISABLE&target=test@example.com',
    isAuthed: true,
    sessionData: {
      'disable2FA#transactionID': 'test_transaction_id',
    },
    user: {
      email: 'test@example.com',
    },
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa',
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: /verify/i });

  await user.type(codeInput, '999999');
  await user.click(submitButton);

  const accountRoute = await screen.findByText('ACCOUNT_ROUTE');

  expect(accountRoute).toBeInTheDocument();

  const twoFactorAuth = db.verification.findFirst({
    where: {
      target: { equals: 'test@example.com' },
      type: { equals: VerificationType.TwoFactorAuth },
    },
  });

  const twoFactorAuthDisable = db.verification.findFirst({
    where: {
      target: { equals: 'test@example.com' },
      type: { equals: VerificationType.TwoFactorAuthDisable },
    },
  });

  expect(twoFactorAuth).toBeNull();
  expect(twoFactorAuthDisable).toBeNull();

  const verifySession = await verifySessionStorage.getSession(setCookieHeader);

  expect(verifySession.get('disable2FA#transactionID')).toBeUndefined();
});

test('it handles 2FA login and redirects to the nexus on success', async () => {
  db.user.create({
    email: 'test@example.com',
    id: 'user_id',
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa',
  });

  db.session.create({
    userID: 'user_id',
  });

  const { user } = setupTest({
    initialPath: '/verify-otp?type=TWO_FACTOR_AUTH&target=test@example.com',
    sessionData: {
      'login2FA#sessionID': 'test_unverified_session_id',
      'login2FA#transactionID': 'test_transaction_id',
    },
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: /verify/i });

  await user.type(codeInput, '999999');
  await user.click(submitButton);

  const nexusRoute = await screen.findByText('NEXUS_ROUTE');

  expect(nexusRoute).toBeInTheDocument();

  const verifySession = await verifySessionStorage.getSession(setCookieHeader);

  expect(verifySession.get('login2FA#sessionID')).toBeUndefined();
  expect(verifySession.get('login2FA#transactionID')).toBeUndefined();
  expect(verifySession.get('login2FA#transactionToken')).toBeUndefined();
});

test('it handles 2FA login and redirects to the logout sessions route when a previous session exists', async () => {
  db.user.create({
    email: 'test@example.com',
    id: 'user_id',
  });

  db.session.create({
    userID: 'user_id',
    verified: true,
  });

  db.session.create({
    userID: 'user_id',
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa',
  });

  const { user } = setupTest({
    initialPath: '/verify-otp?type=TWO_FACTOR_AUTH&target=test@example.com',
    sessionData: {
      'login2FA#sessionID': 'test_unverified_session_id',
      'login2FA#transactionID': 'test_transaction_id',
    },
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: /verify/i });

  await user.type(codeInput, '999999');
  await user.click(submitButton);

  const forceLogoutRoute = await screen.findByText('FORCE_LOGOUT_ROUTE');

  expect(forceLogoutRoute).toBeInTheDocument();

  const verifySession = await verifySessionStorage.getSession(setCookieHeader);

  expect(verifySession.get('loginLogout#email')).toBe('test@example.com');
  expect(verifySession.get('loginLogout#transactionToken')).toBe('valid_transaction_token');
  expect(verifySession.get('login2FA#sessionID')).toBe('test_unverified_session_id');
});

test('it handles changing email and redirects to the change email route on success', async () => {
  const { user } = setupTest({
    initialPath: '/verify-otp?type=CHANGE_EMAIL&target=test@example.com',
    sessionData: {
      'changeEmail#transactionID': 'test_transaction_id',
    },
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa',
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: /verify/i });

  await user.type(codeInput, '999999');
  await user.click(submitButton);

  const changeEmailRoute = await screen.findByText('CHANGE_EMAIL_ROUTE');

  expect(changeEmailRoute).toBeInTheDocument();

  const verifySession = await verifySessionStorage.getSession(setCookieHeader);

  expect(verifySession.get('changeEmail#transactionID')).toBeUndefined();
  expect(verifySession.get('changeEmail#transactionToken')).toBe('valid_transaction_token');
});

test('it handles changed email verification and redirects to the account route on success', async () => {
  const { user } = setupTest({
    initialPath: '/verify-otp?type=CHANGE_EMAIL_CONFIRMATION&target=test@example.com',
    isAuthed: true,
    sessionData: {
      'changeEmailConfirm#transactionID': 'test_transaction_id',
    },
  });

  db.verification.create({
    target: 'test@example.com',
    type: 'change-email',
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: /verify/i });

  await user.type(codeInput, '999999');
  await user.click(submitButton);

  const accountRoute = await screen.findByText('ACCOUNT_ROUTE');

  expect(accountRoute).toBeInTheDocument();

  const verifySession = await verifySessionStorage.getSession(setCookieHeader);

  expect(verifySession.get('changeEmailConfirm#transactionID')).toBeUndefined();
});

test('it handles change password verification and redirects to the change password route on success', async () => {
  const { user } = setupTest({
    initialPath: '/verify-otp?type=CHANGE_PASSWORD&target=test@example.com',
    isAuthed: true,
    sessionData: {
      'changePassword#transactionID': 'test_transaction_id',
    },
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa',
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: /verify/i });

  await user.type(codeInput, '999999');
  await user.click(submitButton);

  const changeUserPasswordRoute = await screen.findByText('CHANGE_PASSWORD_ROUTE');

  expect(changeUserPasswordRoute).toBeInTheDocument();

  const verifySession = await verifySessionStorage.getSession(setCookieHeader);

  expect(verifySession.get('changePassword#transactionID')).toBeUndefined();
  expect(verifySession.get('changePassword#transactionToken')).toBe('valid_transaction_token');
});

test('it shows error for invalid verification code', async () => {
  const { user } = setupTest({
    initialPath: '/verify-otp?type=TWO_FACTOR_AUTH&target=test@example.com',
    sessionData: {
      'login2FA#transactionID': 'test_transaction_id',
    },
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa',
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: /verify/i });

  await user.type(codeInput, '654321'); // Wrong code
  await user.click(submitButton);

  const errorText = await screen.findByText(/invalid verification code/i);

  expect(errorText).toBeInTheDocument();
});

test('it shows a generic error if the mutation fails', async () => {
  server.use(
    graphql.mutation('VerifyOTP', () => {
      throw new GraphQLError('Something went wrong');
    }),
  );

  const { user } = setupTest({
    initialPath: '/verify-otp?type=TWO_FACTOR_AUTH&target=test@example.com',
    sessionData: {
      'login2FA#transactionID': 'test_transaction_id',
    },
  });

  const codeInput = await screen.findByTestId('otp-input');
  const submitButton = screen.getByRole('button', { name: /verify/i });

  await user.type(codeInput, '999999');
  await user.click(submitButton);

  const error = await screen.findByText('Something went wrong');

  expect(error).toBeInTheDocument();
});

test('it redirects to signup for invalid verification type', async () => {
  setupTest({
    initialPath: '/verify-otp?type=INVALID_TYPE&target=test@example.com',
  });

  const signupRoute = await screen.findByText('INDEX_ROUTE');

  expect(signupRoute).toBeInTheDocument();
});
