import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { getSceneState } from '@vers/game-rendering';
import { buildQueryClient } from './lib/query/build-query-client';
import { orpc } from './lib/rpc/orpc';
import { classifySceneTransition } from './lib/scene/classify-scene-transition';
import { resolveSceneStateForLocation } from './lib/scene/resolve-scene-state-for-location';
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

/**
 * Builds a fresh router + query client pair for each request (SSR) or the one browser session.
 */
export function getRouter() {
  const queryClient = buildQueryClient();
  const nonce = getCSPNonce();

  const router = createRouter({
    context: { orpc, queryClient },
    defaultViewTransition: {
      types: (locationChangeInfo) => {
        const current = getSceneState();
        const next = resolveSceneStateForLocation(router, locationChangeInfo.toLocation, current);

        return classifySceneTransition(current, next);
      },
    },
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
