import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { orpc } from './lib/rpc/orpc';
import { routeTree } from './routeTree.gen';

/** Builds a fresh router + query client pair for each request (SSR) or the one browser session. */
export function getRouter() {
  const queryClient = new QueryClient();

  const router = createRouter({
    context: { orpc, queryClient },
    routeTree,
    scrollRestoration: true,
  });

  setupRouterSsrQueryIntegration({ queryClient, router });

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
