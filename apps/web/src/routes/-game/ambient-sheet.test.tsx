import { expect, test } from 'bun:test';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { AmbientSheet } from './ambient-sheet';

test('it hosts the route content in a dialog with a dismiss control', async () => {
  renderWithRouter(
    <AmbientSheet>
      <p>hosted panel</p>
    </AmbientSheet>,
  );

  const dialog = await screen.findByRole('dialog');

  expect(dialog).toBeInTheDocument();
  expect(screen.getByText('hosted panel')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Close/ })).toBeInTheDocument();
});

test('it dismisses to the region map when the close control is used', async () => {
  const user = userEvent.setup();
  const rootRoute = createRootRoute({ component: () => <Outlet /> });

  const gameRoute = createRoute({
    component: () => <Outlet />,
    getParentRoute: () => rootRoute,
    id: '/_game',
  });

  const stashRoute = createRoute({
    component: () => (
      <AmbientSheet>
        <p>hosted panel</p>
      </AmbientSheet>
    ),
    getParentRoute: () => gameRoute,
    path: '/',
  });

  const exploreRoute = createRoute({
    component: () => <p>region map</p>,
    getParentRoute: () => gameRoute,
    path: 'explore',
  });

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute.addChildren([gameRoute.addChildren([stashRoute, exploreRoute])]),
  });

  render(<RouterProvider router={router} />);

  await screen.findByText('hosted panel');
  await user.click(screen.getByRole('button', { name: /Close/ }));

  const regionMap = await screen.findByText('region map');

  expect(regionMap).toBeInTheDocument();
});
