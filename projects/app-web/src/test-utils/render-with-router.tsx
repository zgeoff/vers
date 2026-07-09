import { QueryClient } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

/**
 * Renders a component tree that uses router-aware primitives (`Link`, `useRouter`, …) and Query
 * hooks (`useQuery`, `useSuspenseQuery`, …) without a real route tree: the component under test
 * becomes the sole root route's own component, so both resolve the same way they do under the
 * app's real router, which wires its `QueryClient` in the same way.
 */
export function renderWithRouter(ui: Readonly<ReactElement>): ReturnType<typeof render> {
  const rootRoute = createRootRoute({ component: () => ui });

  const queryClient = new QueryClient();

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute,
  });

  setupRouterSsrQueryIntegration({ queryClient, router });

  return render(<RouterProvider router={router} />);
}
