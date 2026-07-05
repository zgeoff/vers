import { drop } from '@mswjs/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Class } from '@vers/data';
import { createRoutesStub } from 'react-router';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { composeDataFnWrappers } from '../../test-utils/compose-data-fn-wrappers';
import { withAppLoadContext } from '../../test-utils/with-app-load-context';
import { withAuthedUser } from '../../test-utils/with-authed-user';
import { withRouteProps } from '../../test-utils/with-route-props';
import { Routes } from '../../types';
import { Avatar, loader } from './route';

interface TestConfig {
  isAuthed: boolean;
  user?: {
    id?: string;
  };
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
function setupTest(config: TestConfig) {
  const user = userEvent.setup();

  const _loader = composeDataFnWrappers(
    loader,
    withAppLoadContext,
    config.isAuthed && ((_) => withAuthedUser(_, { user: config.user })),
  );

  const AvatarStub = createRoutesStub([
    {
      Component: withRouteProps(Avatar),
      loader: _loader,
      path: '/',
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

  render(<AvatarStub />);

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

test("it renders the user's avatar", async () => {
  db.avatar.create({
    class: Class.Scoundrel,
    level: 20,
    name: 'Test Avatar',
    userID: 'user_id',
  });

  setupTest({ isAuthed: true, user: { id: 'user_id' } });

  const name = await screen.findByText('Test Avatar');
  const level = screen.getByText('Level 20');
  const className = screen.getByText('Scoundrel');

  expect(name).toBeInTheDocument();
  expect(level).toBeInTheDocument();
  expect(className).toBeInTheDocument();
});

test('it redirects to the avatar create route when the user does not have an avatar', async () => {
  setupTest({ isAuthed: true, user: { id: 'user_id' } });

  const avatarCreateRoute = await screen.findByText('AVATAR_CREATE_ROUTE');

  expect(avatarCreateRoute).toBeInTheDocument();
});
