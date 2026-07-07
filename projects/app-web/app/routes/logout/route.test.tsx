import { drop } from '@mswjs/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphql } from 'msw';
import { Form, createRoutesStub } from 'react-router';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { server } from '../../mocks/node';
import { composeDataFnWrappers } from '../../test-utils/compose-data-fn-wrappers';
import { withAppLoadContext } from '../../test-utils/with-app-load-context';
import { withAuthedUser } from '../../test-utils/with-authed-user';
import { Routes } from '../../types';
import { action, loader } from './route';

interface TestConfig {
  initialPath?: string;
  sessionID?: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
function setupTest(config: TestConfig) {
  const user = userEvent.setup();

  const _action = composeDataFnWrappers(action, withAppLoadContext, (_) =>
    withAuthedUser(_, { sessionID: config.sessionID }),
  );

  const LogoutStub = createRoutesStub([
    {
      Component: () => (
        <Form action={Routes.Logout} method="post">
          <button type="submit">Logout</button>
        </Form>
      ),
      path: Routes.Nexus,
    },
    {
      action: _action,
      Component: () => 'LOGOUT_ROUTE',
      loader,
      path: Routes.Logout,
    },
    {
      Component: () => 'INDEX_ROUTE',
      path: Routes.Index,
    },
  ]);

  render(<LogoutStub initialEntries={[config.initialPath ?? Routes.Nexus]} />);

  return { user };
}

afterEach(() => {
  drop(db);

  server.resetHandlers();
});

test('it redirects to index page and deletes the session', async () => {
  const ctx = setupTest({ sessionID: 'test-session-id' });

  const logoutButton = screen.getByRole('button', { name: 'Logout' });

  await ctx.user.click(logoutButton);

  const indexRoute = await screen.findByText('INDEX_ROUTE');

  expect(indexRoute).toBeInTheDocument();

  const deletedSession = db.session.findFirst({
    where: {
      id: {
        equals: 'test-session-id',
      },
    },
  });

  expect(deletedSession).toBeNull();
});

test('it still redirects to index page when session deletion fails', async () => {
  server.use(
    graphql.mutation('DeleteSession', () => {
      throw new Error('Internal server error');
    }),
  );

  const ctx = setupTest({});

  const logoutButton = screen.getByRole('button', { name: 'Logout' });

  await ctx.user.click(logoutButton);

  const indexRoute = await screen.findByText('INDEX_ROUTE');

  expect(indexRoute).toBeInTheDocument();
});

test('it redirects to the index page if directly loaded', async () => {
  setupTest({ initialPath: Routes.Logout });

  const indexRoute = await screen.findByText('INDEX_ROUTE');

  expect(indexRoute).toBeInTheDocument();
});
