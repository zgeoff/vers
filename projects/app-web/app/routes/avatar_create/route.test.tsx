import { drop } from '@mswjs/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Class } from '@vers/data';
import { GraphQLError } from 'graphql';
import { HttpResponse, graphql } from 'msw';
import { createRoutesStub } from 'react-router';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { AVATAR_NAME_EXISTS_ERROR } from '../../mocks/errors';
import { server } from '../../mocks/node';
import { composeDataFnWrappers } from '../../test-utils/compose-data-fn-wrappers';
import { withAppLoadContext } from '../../test-utils/with-app-load-context';
import { withAuthedUser } from '../../test-utils/with-authed-user';
import { withRouteProps } from '../../test-utils/with-route-props';
import { Routes } from '../../types';
import { AvatarCreate, action, loader } from './route';

interface TestConfig {
  isAuthed: boolean;
  user?: {
    id?: string;
  };
}

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

  const LoginStub = createRoutesStub([
    {
      action: _action,
      Component: withRouteProps(AvatarCreate),
      loader: _loader,
      path: '/',
    },
    {
      Component: () => 'AVATAR_ROUTE',
      path: Routes.Avatar,
    },
    {
      Component: () => 'LOGIN_ROUTE',
      path: Routes.Login,
    },
  ]);

  render(<LoginStub />);

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

test('it renders the avatar create form when authenticated', async () => {
  setupTest({ isAuthed: true });

  const classInput = await screen.findByLabelText('Choose Your Class');
  const classes = screen.getAllByRole('radio');
  const bruteClass = screen.getByRole('radio', { name: /Brute/ });
  const scholarClass = screen.getByRole('radio', { name: /Scholar/ });
  const scoundrelClass = screen.getByRole('radio', { name: /Scoundrel/ });
  const nameInput = screen.getByLabelText('Name');
  const submitButton = screen.getByRole('button', { name: 'Create Avatar' });

  expect(classInput).toBeInTheDocument();
  expect(classes).toHaveLength(Object.keys(Class).length);
  expect(bruteClass).toBeInTheDocument();
  expect(scholarClass).toBeInTheDocument();
  expect(scoundrelClass).toBeInTheDocument();
  expect(nameInput).toBeInTheDocument();
  expect(submitButton).toBeInTheDocument();
});

test('it creates an avatar when the form is submitted and redirects to the avatar route', async () => {
  const { user } = setupTest({ isAuthed: true, user: { id: 'user_id' } });

  const bruteClass = await screen.findByText('Brute');
  const nameInput = screen.getByLabelText('Name');
  const submitButton = screen.getByRole('button', { name: 'Create Avatar' });

  await user.click(bruteClass);
  await user.type(nameInput, 'TestAvatar');
  await user.click(submitButton);

  const avatarRoute = await screen.findByText('AVATAR_ROUTE');

  expect(avatarRoute).toBeInTheDocument();

  const avatar = db.avatar.findFirst({
    where: { userID: { equals: 'user_id' } },
  });

  expect(avatar).toMatchObject({
    class: 'brute',
    name: 'TestAvatar',
  });
});

test('it prevents adding spaces, numbers, and special characters to the name', async () => {
  const { user } = setupTest({ isAuthed: true, user: { id: 'user_id' } });

  const nameInput = await screen.findByLabelText('Name');
  const scholarClass = screen.getByRole('radio', { name: /Scholar/ });
  const submitButton = screen.getByRole('button', { name: 'Create Avatar' });

  await user.type(nameInput, 'Test123_ Avatar#(');
  await user.click(scholarClass);
  await user.click(submitButton);

  const avatarRoute = await screen.findByText('AVATAR_ROUTE');

  expect(avatarRoute).toBeInTheDocument();

  const avatar = db.avatar.findFirst({
    where: { userID: { equals: 'user_id' } },
  });

  expect(avatar).toMatchObject({
    class: 'scholar',
    name: 'TestAvatar',
  });
});

test('it displays an ambiguous error when the api call fails', async () => {
  server.use(
    graphql.mutation('CreateAvatar', () => {
      throw new GraphQLError('Something went wrong');
    }),
  );

  const { user } = setupTest({ isAuthed: true, user: { id: 'user_id' } });

  const nameInput = await screen.findByLabelText('Name');
  const scholarClass = screen.getByRole('radio', { name: /Scholar/ });
  const submitButton = screen.getByRole('button', { name: 'Create Avatar' });

  await user.type(nameInput, 'TestAvatar');
  await user.click(scholarClass);
  await user.click(submitButton);

  const error = await screen.findByText('Something went wrong');

  expect(error).toBeInTheDocument();
});

test('it displays the mutation error if one is returned', async () => {
  server.use(
    graphql.mutation('CreateAvatar', () =>
      HttpResponse.json({
        data: {
          createAvatar: {
            error: AVATAR_NAME_EXISTS_ERROR,
          },
        },
      }),
    ),
  );

  const { user } = setupTest({ isAuthed: true, user: { id: 'user_id' } });

  const nameInput = await screen.findByLabelText('Name');
  const scoundrelClass = screen.getByRole('radio', { name: /Scoundrel/ });
  const submitButton = screen.getByRole('button', { name: 'Create Avatar' });

  await user.type(nameInput, 'TestAvatar');
  await user.click(scoundrelClass);
  await user.click(submitButton);

  const error = await screen.findByText('An Avatar with this name already exists.');

  expect(error).toBeInTheDocument();
});
