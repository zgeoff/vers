import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { orpc } from './lib/rpc/orpc';
import { routeTree } from './routeTree.gen';
import { CSP_NONCE_HEADER } from './server/csp-nonce-header';

/**
 * The secure-headers middleware stamps this onto the request before the SSR handler runs; reading
 * it back is the only way this isomorphic factory can recover a per-request value, since it has
 * no other channel into request middleware context.
 */
const getCSPNonce = createIsomorphicFn()
  .server(() => getRequestHeader(CSP_NONCE_HEADER))
  .client(() => {
    // no request middleware on the client to have stamped a nonce
  });

/** Builds a fresh router + query client pair for each request (SSR) or the one browser session. */
export function getRouter() {
  const queryClient = new QueryClient();

  const nonce = getCSPNonce();

  const router = createRouter({
    context: { orpc, queryClient },
    routeTree,
    scrollRestoration: true,
    // `exactOptionalPropertyTypes` rejects an explicit `nonce: undefined`, so the property is
    // omitted entirely on the client rather than set to `undefined`.
    ...(nonce !== undefined && { ssr: { nonce } }),
  });

  setupRouterSsrQueryIntegration({ queryClient, router });

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
