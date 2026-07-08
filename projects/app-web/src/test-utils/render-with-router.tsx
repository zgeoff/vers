import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

/**
 * Renders a component tree that uses router-aware primitives (`Link`, `useRouter`, …) without a
 * real route tree: the component under test becomes the sole root route's own component, so
 * `useRouter()` resolves the same way it does under the app's real router.
 */
export function renderWithRouter(ui: Readonly<ReactElement>): ReturnType<typeof render> {
  const rootRoute = createRootRoute({ component: () => ui });

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute,
  });

  return render(<RouterProvider router={router} />);
}
