import { QueryClient } from '@tanstack/react-query';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { render } from '@testing-library/react';
import type { FlagKey } from '@vers/flags';
import type { ReactElement } from 'react';

interface RenderWithRouterOptions {
  /** Seeds the `/_game` layout route's context, read via `useRouteContext({ from: '/_game' })`. */
  readonly flags?: Readonly<Record<FlagKey, boolean>>;
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
): ReturnType<typeof render> {
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

  // catches navigation to any other in-app path a rendered `<Link>` points at (e.g. clicking a
  // nav item), so it resolves instead of 404ing against this synthetic tree's single real route
  const catchAllRoute = createRoute({
    component: () => ui,
    getParentRoute: () => gameRoute,
    path: '$',
  });

  const queryClient = new QueryClient();

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute.addChildren([gameRoute.addChildren([indexRoute, catchAllRoute])]),
  });

  setupRouterSsrQueryIntegration({ queryClient, router });

  return render(<RouterProvider router={router} />);
}
