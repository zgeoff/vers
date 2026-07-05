import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { expect, test } from 'vitest';
import { composeDataFnWrappers } from '../../test-utils/compose-data-fn-wrappers';
import { withAppLoadContext } from '../../test-utils/with-app-load-context';
import { withAuthedUser } from '../../test-utils/with-authed-user';
import { Routes } from '../../types';
import { ResetPasswordStarted, loader } from './route';

interface TestConfig {
  isAuthed?: boolean;
}

function setupTest(config: TestConfig = {}) {
  const user = userEvent.setup();

  const _loader = composeDataFnWrappers(
    loader,
    withAppLoadContext,
    config.isAuthed && withAuthedUser,
  );

  const ResetPasswordStartedStub = createRoutesStub([
    {
      Component: ResetPasswordStarted,
      loader: _loader,
      path: '/',
    },
    {
      Component: () => 'NEXUS_ROUTE',
      path: Routes.Nexus,
    },
    {
      Component: () => 'FORGOT_PASSWORD_ROUTE',
      path: Routes.ForgotPassword,
    },
  ]);

  render(<ResetPasswordStartedStub />);

  return { user };
}

test('it redirects to the nexus if the user is authenticated', async () => {
  setupTest({ isAuthed: true });

  const nexusRoute = await screen.findByText('NEXUS_ROUTE');

  expect(nexusRoute).toBeInTheDocument();
});

test('it renders the reset password started page with a link to request another reset email', async () => {
  setupTest();

  const title = await screen.findByText('Check your email');

  const resetLink = screen.getByRole('link', {
    name: 'try requesting another one',
  });

  expect(title).toBeInTheDocument();
  expect(resetLink).toBeInTheDocument();
  expect(resetLink).toHaveAttribute('href', Routes.ForgotPassword);
});
