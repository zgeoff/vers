import { drop } from '@mswjs/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { afterEach, expect, test } from 'vitest';
import { db } from '~/mocks/db';
import { composeDataFnWrappers } from '~/test-utils/compose-data-fn-wrappers';
import { withAppLoadContext } from '~/test-utils/with-app-load-context';
import { withAuthedUser } from '~/test-utils/with-authed-user';
import { withRouteProps } from '~/test-utils/with-route-props';
import { Routes } from '~/types';
import { Nexus, loader } from './route';

interface TestConfig {
  isAuthed: boolean;
  user?: {
    id?: string;
  };
}

function setupTest(config: TestConfig) {
  const user = userEvent.setup();

  const _loader = composeDataFnWrappers(
    loader,
    withAppLoadContext,
    config.isAuthed && ((_) => withAuthedUser(_, { user: config.user })),
  );

  const NexusStub = createRoutesStub([
    {
      Component: withRouteProps(Nexus),
      loader: _loader,
      path: '/',
    },
    {
      action: () => null,
      Component: () => 'LOGOUT_ROUTE',
      path: Routes.Logout,
    },
    {
      Component: () => 'LOGIN_ROUTE',
      path: Routes.Login,
    },
    {
      Component: () => 'AVATAR_CREATE_ROUTE',
      path: Routes.AvatarCreate,
    },
  ]);

  render(<NexusStub />);

  return { user };
}

afterEach(() => {
  drop(db);
});

test('it redirects to the login route when not authenticated', async () => {
  setupTest({ isAuthed: false });

  const loginRoute = await screen.findByText('LOGIN_ROUTE');

  expect(loginRoute).toBeInTheDocument();
});

test('it renders the nexus when authenticated and a user has an avatar', async () => {
  db.avatar.create({ userID: 'user_id' });

  setupTest({ isAuthed: true, user: { id: 'user_id' } });

  const nexus = await screen.findByText('Nexus');

  expect(nexus).toBeInTheDocument();
});

test('it renders a call to action when a user does not have an avatar', async () => {
  const { user } = setupTest({ isAuthed: true, user: { id: 'user_id' } });

  const callToAction = await screen.findByText('Awaken your Avatar');

  expect(callToAction).toBeInTheDocument();

  await user.click(callToAction);

  const avatarCreateRoute = await screen.findByText('AVATAR_CREATE_ROUTE');

  expect(avatarCreateRoute).toBeInTheDocument();
});
