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
  /**
   * Seeds the `/_game` layout route's context, read via `useRouteContext({ from: '/_game' })`.
   */
  readonly flags?: Readonly<Record<FlagKey, boolean>>;
  /**
   * Extra destinations mounted as real routes under the `/_game` layout, each rendering its
   * element: navigation tests declare where a transition lands so it resolves to an explicit
   * marker instead of the catch-all re-rendering the component under test.
   */
  readonly routes?: Readonly<Record<string, Readonly<ReactElement>>>;
}

interface RenderWithRouterResult extends ReturnType<typeof render> {
  /**
   * The router the tree mounted under: assert `router.state.location.pathname` after a real
   * transition, or drive one with `router.navigate(...)`.
   */
  readonly router: AnyRouter;
}

/**
 * Renders a component tree that uses router-aware primitives (`Link`, `useRouter`, …) and Query
 * hooks (`useQuery`, `useSuspenseQuery`, …) without a real route tree: the component under test
 * becomes the index route nested under a pathless `/_game`-id layout route, so both resolve the
 * same way they do under the app's real router — which wires its `QueryClient` the same way and
 * resolves flags onto that same route id.
 */
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
