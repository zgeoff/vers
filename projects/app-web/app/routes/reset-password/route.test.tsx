import { drop } from '@mswjs/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphQLError } from 'graphql';
import { graphql } from 'msw';
import { createRoutesStub } from 'react-router';
import { afterEach, expect, test } from 'vitest';
import { VerificationType } from '../../gql/graphql';
import { db } from '../../mocks/db';
import { server } from '../../mocks/node';
import { verifySessionStorage } from '../../session/verify-session-storage.server';
import { withAppLoadContext } from '../../test-utils/with-app-load-context';
import { withRouteProps } from '../../test-utils/with-route-props';
import { Routes } from '../../types';
import type { Route } from './+types/route';
import { ResetPassword, action, loader } from './route';

interface TestConfig {
  initialPath: string;
  transactionToken?: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
async function setupTest(config: TestConfig) {
  const user = userEvent.setup();

  const verifySession = await verifySessionStorage.getSession();

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (config.transactionToken) {
    verifySession.set('resetPassword#transactionToken', config.transactionToken);
  }

  const cookie = await verifySessionStorage.commitSession(verifySession);

  const _loader = withAppLoadContext(loader);
  const _action = withAppLoadContext(action);

  // wrap our loader that sets our cookie in the request
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  const loaderWithCookie = (args: Route.LoaderArgs) => {
    args.request.headers.set('cookie', cookie);

    return _loader({ ...args, params: {} });
  };

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  const actionWithCookie = (args: Route.ActionArgs) => {
    args.request.headers.set('cookie', cookie);

    return _action(args);
  };

  const ResetPasswordStub = createRoutesStub([
    {
      action: actionWithCookie,
      Component: withRouteProps(ResetPassword),
      loader: loaderWithCookie,
      path: '/',
    },
    {
      Component: () => 'LOGIN_ROUTE',
      path: Routes.Login,
    },
  ]);

  render(<ResetPasswordStub initialEntries={[config.initialPath]} />);

  return { user };
}

afterEach(() => {
  server.resetHandlers();

  drop(db);
});

test('it renders the reset password form with accessible elements', async () => {
  await setupTest({
    initialPath: '/?email=test@example.com&token=test_reset_token',
  });

  const newPasswordInput = await screen.findByLabelText('New Password');
  const confirmPasswordInput = screen.getByLabelText('Confirm Password');
  const submitButton = screen.getByRole('button', { name: 'Reset Password' });
  const loginLink = screen.getByRole('link', { name: 'Login' });

  expect(newPasswordInput).toBeInTheDocument();
  expect(confirmPasswordInput).toBeInTheDocument();
  expect(submitButton).toBeInTheDocument();
  expect(loginLink).toBeInTheDocument();
});

test('it shows validation errors for mismatched passwords', async () => {
  const ctx = await setupTest({
    initialPath: '/?email=test@example.com&token=test_reset_token',
  });

  const newPasswordInput = await screen.findByLabelText('New Password');
  const confirmPasswordInput = screen.getByLabelText('Confirm Password');
  const submitButton = screen.getByRole('button', { name: 'Reset Password' });

  await ctx.user.type(newPasswordInput, 'password123');
  await ctx.user.type(confirmPasswordInput, 'password456');
  await ctx.user.click(submitButton);

  const errorText = await screen.findByText('The passwords must match');

  expect(errorText).toBeInTheDocument();
});

test('it shows validation errors for invalid password', async () => {
  const ctx = await setupTest({
    initialPath: '/?email=test@example.com&token=test_reset_token',
  });

  const newPasswordInput = await screen.findByLabelText('New Password');
  const confirmPasswordInput = screen.getByLabelText('Confirm Password');
  const submitButton = screen.getByRole('button', { name: 'Reset Password' });

  await ctx.user.type(newPasswordInput, 'weak');
  await ctx.user.type(confirmPasswordInput, 'weak');
  await ctx.user.click(submitButton);

  const errorText = await screen.findAllByText('Password must be 8+ characters');

  expect(errorText).toHaveLength(2);
});

test('it redirects to login on successful password reset', async () => {
  const ctx = await setupTest({
    initialPath: '/?email=test@example.com&token=test_reset_token',
  });

  db.user.create({
    email: 'test@example.com',
    password: 'oldpassword123',
  });

  const newPasswordInput = await screen.findByLabelText('New Password');
  const confirmPasswordInput = screen.getByLabelText('Confirm Password');
  const submitButton = screen.getByRole('button', { name: 'Reset Password' });

  await ctx.user.type(newPasswordInput, 'newpassword123');
  await ctx.user.type(confirmPasswordInput, 'newpassword123');
  await ctx.user.click(submitButton);

  const loginRoute = await screen.findByText('LOGIN_ROUTE');

  expect(loginRoute).toBeInTheDocument();
});

test('it redirects to login if reset token is missing from params', async () => {
  await setupTest({ initialPath: '/?email=test@example.com' });

  const loginRoute = await screen.findByText('LOGIN_ROUTE');

  expect(loginRoute).toBeInTheDocument();
});

test('it redirects to login if the email is missing from the params', async () => {
  await setupTest({ initialPath: '/?token=test_reset_token' });

  const loginRoute = await screen.findByText('LOGIN_ROUTE');

  expect(loginRoute).toBeInTheDocument();
});

test('it passes the transaction token if 2FA was required for the reset', async () => {
  const ctx = await setupTest({
    initialPath: '/?email=test@example.com&token=test_reset_token',
    transactionToken: 'valid_transaction_token',
  });

  db.user.create({
    email: 'test@example.com',
    password: 'oldpassword123',
  });

  db.verification.create({
    target: 'test@example.com',
    type: VerificationType.TwoFactorAuth,
  });

  const newPasswordInput = await screen.findByLabelText('New Password');
  const confirmPasswordInput = screen.getByLabelText('Confirm Password');
  const submitButton = screen.getByRole('button', { name: 'Reset Password' });

  await ctx.user.type(newPasswordInput, 'newpassword123');
  await ctx.user.type(confirmPasswordInput, 'newpassword123');
  await ctx.user.click(submitButton);

  const loginRoute = await screen.findByText('LOGIN_ROUTE');

  expect(loginRoute).toBeInTheDocument();

  const updatedUser = db.user.findFirst({
    where: {
      email: { equals: 'test@example.com' },
    },
  });

  expect(updatedUser?.password).toBe('newpassword123');
});

test('it shows a generic error if the mutation fails', async () => {
  server.use(
    graphql.mutation('FinishPasswordReset', () => {
      throw new GraphQLError('Something went wrong');
    }),
  );

  const ctx = await setupTest({
    initialPath: '/?email=test@example.com&token=test_reset_token',
  });

  const newPasswordInput = await screen.findByLabelText('New Password');
  const confirmPasswordInput = screen.getByLabelText('Confirm Password');
  const submitButton = screen.getByRole('button', { name: 'Reset Password' });

  await ctx.user.type(newPasswordInput, 'newpassword123');
  await ctx.user.type(confirmPasswordInput, 'newpassword123');
  await ctx.user.click(submitButton);

  const error = await screen.findByText('Something went wrong');

  expect(error).toBeInTheDocument();
});
