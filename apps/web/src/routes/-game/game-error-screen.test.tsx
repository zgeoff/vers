import { expect, test } from 'bun:test';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { readServerFnResponse } from '../../lib/offline/read-server-fn-response';
import { readWithLastKnown } from '../../lib/offline/read-with-last-known';
import { buildQueryClient } from '../../lib/query/build-query-client';
import { server } from '../../mocks/node';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { GameErrorScreen } from './game-error-screen';

function setupTest() {
  const queryClient = buildQueryClient();
  const rootRoute = createRootRoute();

  const gameRoute = createRoute({
    component: () => <p>screen opened</p>,
    errorComponent: GameErrorScreen,
    getParentRoute: () => rootRoute,
    loader: () =>
      readWithLastKnown(queryClient, 'flags', async () => {
        const response = await readServerFnResponse('http://app.test/_serverFn/flags');

        return response.text();
      }),
    path: '/',
  });

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute.addChildren([gameRoute]),
  });

  return { router };
}

test('it shows the offline notice when a game route fails offline with nothing known', async () => {
  const ctx = setupTest();

  server.use(http.get('http://app.test/_serverFn/flags', () => HttpResponse.error()));

  const rendered = render(<RouterProvider router={ctx.router} />);

  const heading = await rendered.findByRole('heading', { name: 'You are offline' });

  expect(heading).toBeVisible();
  expect(rendered.queryByText('Something went wrong')).toBeNull();
});

test('it opens the screen when the player retries after the network returns', async () => {
  const ctx = setupTest();

  server.use(http.get('http://app.test/_serverFn/flags', () => HttpResponse.error()));

  const rendered = render(<RouterProvider router={ctx.router} />);

  const retryButton = await rendered.findByRole('button', { name: 'Try again' });

  server.use(http.get('http://app.test/_serverFn/flags', () => HttpResponse.text('market-on')));

  await userEvent.click(retryButton);

  const screen = await rendered.findByText('screen opened');

  expect(screen).toBeVisible();
});

test('it shows the root error screen for a fault that is not a network failure', async () => {
  const rendered = renderWithRouter(
    <GameErrorScreen error={new Error('session lookup failed')} reset={() => {}} />,
  );

  const heading = await rendered.findByRole('heading', { name: 'Something went wrong' });

  expect(heading).toBeVisible();
});
