import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import type { AnyRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { render } from '@testing-library/react';
import type { FlagKey } from '@vers/flags';
import type { ReactElement } from 'react';
import { buildQueryClient } from '../lib/query/build-query-client';

interface RenderWithRouterOptions {
  readonly flags?: Readonly<Record<FlagKey, boolean>>;
  readonly routes?: Readonly<Record<string, Readonly<ReactElement>>>;
}

interface RenderWithRouterResult extends ReturnType<typeof render> {
  readonly router: AnyRouter;
}

export function renderWithRouter(
  ui: Readonly<ReactElement>,
  options?: Readonly<RenderWithRouterOptions>,
): RenderWithRouterResult {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });

  const gameRoute = createRoute({
    beforeLoad: () => ({ flags: options?.flags ?? {} }),
    component: () => <Outlet />,
    getParentRoute: () => rootRoute,
    id: '/_game',
  });

  const indexRoute = createRoute({
    component: () => ui,
    getParentRoute: () => gameRoute,
    path: '/',
  });

  const declaredRoutes = Object.entries(options?.routes ?? {}).map(([path, element]) =>
    createRoute({
      component: () => element,
      getParentRoute: () => gameRoute,
      path,
    }),
  );

  // catches navigation to any other in-app path a rendered `<Link>` points at (e.g. clicking a
  // nav item), so it resolves instead of 404ing against this synthetic tree's single real route
  const catchAllRoute = createRoute({
    component: () => ui,
    getParentRoute: () => gameRoute,
    path: '$',
  });

  const queryClient = buildQueryClient();

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute.addChildren([
      gameRoute.addChildren([indexRoute, ...declaredRoutes, catchAllRoute]),
    ]),
  });

  setupRouterSsrQueryIntegration({ queryClient, router });

  return { ...render(<RouterProvider router={router} />), router };
}
