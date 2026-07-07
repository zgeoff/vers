import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { expect, test } from 'vitest';
import { composeDataFnWrappers } from '../../test-utils/compose-data-fn-wrappers';
import { withAppLoadContext } from '../../test-utils/with-app-load-context';
import { withAuthedUser } from '../../test-utils/with-authed-user';
import { Routes } from '../../types';
import { Index, loader } from './route';

interface TestConfig {
  isAuthed: boolean;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
function setupTest(config: TestConfig) {
  const user = userEvent.setup();

  const _loader = composeDataFnWrappers(
    loader,
    withAppLoadContext,
    config.isAuthed && withAuthedUser,
  );

  const IndexStub = createRoutesStub([
    {
      Component: Index,
      loader: _loader,
      path: '/',
    },
    {
      action: () => null,
      Component: () => 'SIGN_UP_ROUTE',
      path: Routes.Signup,
    },
    {
      action: () => null,
      Component: () => 'LOGIN_ROUTE',
      path: Routes.Login,
    },
    {
      Component: () => 'NEXUS_ROUTE',
      path: Routes.Nexus,
    },
  ]);

  render(<IndexStub />);

  return { user };
}

test('it renders a sign up button that navigates to the signup route when clicked', async () => {
  const ctx = setupTest({ isAuthed: false });

  const signUpButton = await screen.findByRole('link', { name: 'Signup' });

  await waitFor(() => ctx.user.click(signUpButton));

  const loggedOutMessage = await screen.findByText('SIGN_UP_ROUTE');

  expect(loggedOutMessage).toBeInTheDocument();
});

test('it renders a log in button that navigates to the log in route when clicked', async () => {
  const ctx = setupTest({ isAuthed: false });

  const logInButton = await screen.findByRole('link', { name: 'Login' });

  await waitFor(() => ctx.user.click(logInButton));

  const loggedOutMessage = await screen.findByText('LOGIN_ROUTE');

  expect(loggedOutMessage).toBeInTheDocument();
});

test('it redirects to the nexus if the user is logged in', async () => {
  setupTest({ isAuthed: true });

  const nexusRoute = await screen.findByText('NEXUS_ROUTE');

  expect(nexusRoute).toBeInTheDocument();
});
