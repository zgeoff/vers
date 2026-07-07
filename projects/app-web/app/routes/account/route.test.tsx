import { drop } from '@mswjs/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphQLError } from 'graphql';
import { graphql } from 'msw';
import { createRoutesStub } from 'react-router';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { server } from '../../mocks/node';
import { composeDataFnWrappers } from '../../test-utils/compose-data-fn-wrappers';
import { withAppLoadContext } from '../../test-utils/with-app-load-context';
import { withAuthedUser } from '../../test-utils/with-authed-user';
import { withRouteProps } from '../../test-utils/with-route-props';
import { Routes } from '../../types';
import { Account, action, loader } from './route';

interface TestConfig {
  isAuthed: boolean;
  user?: {
    email?: string;
    id?: string;
    is2FAEnabled?: boolean;
    name?: string;
  };
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
function setupTest(config: TestConfig) {
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

  const AccountStub = createRoutesStub([
    {
      action: _action,
      Component: withRouteProps(Account),
      loader: _loader,
      path: '/',
    },
    {
      Component: () => 'LOGIN_ROUTE',
      path: Routes.Login,
    },
    {
      action: () => null,
      Component: () => 'LOGOUT_ROUTE',
      path: Routes.Logout,
    },
    {
      Component: () => 'CHANGE_EMAIL_ROUTE',
      path: Routes.AccountChangeEmail,
    },
    {
      Component: () => 'CHANGE_PASSWORD_ROUTE',
      path: Routes.AccountChangePassword,
    },
  ]);

  render(<AccountStub />);

  return { user };
}

afterEach(() => {
  server.resetHandlers();

  drop(db);
});

test('it redirects to the login route when not authenticated', async () => {
  setupTest({ isAuthed: false });

  const loginRoute = await screen.findByText('LOGIN_ROUTE');

  expect(loginRoute).toBeInTheDocument();
});

test('it renders the account page with user information when authenticated', async () => {
  setupTest({
    isAuthed: true,
    user: {
      email: 'test@example.com',
      id: 'user_id',
      is2FAEnabled: false,
      name: 'Test User',
    },
  });

  const name = await screen.findByText('Test User');
  const email = screen.getByText('test@example.com');

  expect(name).toBeInTheDocument();
  expect(email).toBeInTheDocument();
});

test('it takes the user to the change email route when they click the change email link', async () => {
  const setup = setupTest({
    isAuthed: true,
    user: {
      email: 'test@example.com',
      id: 'user_id',
      is2FAEnabled: false,
    },
  });

  const changeEmailLink = await screen.findByText('Change Email');

  await setup.user.click(changeEmailLink);

  const changeEmailRoute = await screen.findByText('CHANGE_EMAIL_ROUTE');

  expect(changeEmailRoute).toBeInTheDocument();
});

test('it takes the user to the change password route when they click the change password link', async () => {
  const setup = setupTest({
    isAuthed: true,
    user: {
      email: 'test@example.com',
      id: 'user_id',
      is2FAEnabled: false,
    },
  });

  const changePasswordLink = await screen.findByText('Change Password');

  await setup.user.click(changePasswordLink);

  const changePasswordRoute = await screen.findByText('CHANGE_PASSWORD_ROUTE');

  expect(changePasswordRoute).toBeInTheDocument();
});

test('it shows an enable 2FA button when the user has not enabled 2FA', async () => {
  setupTest({
    isAuthed: true,
    user: {
      email: 'test@example.com',
      id: 'user_id',
      is2FAEnabled: false,
    },
  });

  const enable2FAButton = await screen.findByRole('button', {
    name: 'Enable 2FA',
  });

  expect(enable2FAButton).toBeInTheDocument();
});

test('it displays a 2FA status enabled message when the user has enabled 2FA', async () => {
  setupTest({
    isAuthed: true,
    user: {
      email: 'test@example.com',
      id: 'user_id',
      is2FAEnabled: true,
    },
  });

  const twoFactorStatus = await screen.findByText('You have enabled two-factor authentication.');

  const disable2FAButton = await screen.findByRole('button', {
    name: 'Disable 2FA',
  });

  expect(twoFactorStatus).toBeInTheDocument();
  expect(disable2FAButton).toBeInTheDocument();
});

test('it shows a generic error if the enable 2FA mutation fails', async () => {
  server.use(
    graphql.mutation('StartEnable2FA', () => {
      throw new GraphQLError('Something went wrong');
    }),
  );

  const setup = setupTest({
    isAuthed: true,
    user: {
      email: 'test@example.com',
      id: 'user_id',
      is2FAEnabled: false,
    },
  });

  const enable2FAButton = await screen.findByRole('button', {
    name: 'Enable 2FA',
  });

  await setup.user.click(enable2FAButton);

  const error = await screen.findByText('Something went wrong');

  expect(error).toBeInTheDocument();
});

test('it shows a generic error if the disable 2FA mutation fails', async () => {
  server.use(
    graphql.mutation('StartStepUpAuth', () => {
      throw new GraphQLError('Something went wrong');
    }),
  );

  const setup = setupTest({
    isAuthed: true,
    user: {
      email: 'test@example.com',
      id: 'user_id',
      is2FAEnabled: true,
    },
  });

  const disable2FAButton = await screen.findByRole('button', {
    name: 'Disable 2FA',
  });

  await setup.user.click(disable2FAButton);

  const error = await screen.findByText('Something went wrong');

  expect(error).toBeInTheDocument();
});

test('it renders a log out button that redirects to the logout route when pressed', async () => {
  const setup = setupTest({
    isAuthed: true,
    user: {
      email: 'test@example.com',
      id: 'user_id',
      is2FAEnabled: false,
    },
  });

  const logoutButton = await screen.findByRole('button', { name: 'Logout' });

  await setup.user.click(logoutButton);

  const loggedOutMessage = await screen.findByText('LOGOUT_ROUTE');

  expect(loggedOutMessage).toBeInTheDocument();
});
