import { fileURLToPath } from 'node:url';
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { serveStatic } from 'srvx/static';
import { enforceHTTPS } from './server/enforce-https';
import { env } from './server/env';
import { logger } from './server/logger';
import { makeRateLimiter } from './server/make-rate-limiter';
import { makeRequestLogger } from './server/make-request-logger';
import { makeSecureHeaders } from './server/make-secure-headers';
import { withMiddleware } from './server/middleware';
import { removeTrailingSlash } from './server/remove-trailing-slash';

// resolved from this built file's own location (`dist/server/server.js`) rather than the
// process's cwd, since the root `server.mjs` shim and the Docker runtime image invoke this bundle
// from different working directories
const CLIENT_ASSETS_DIRECTORY = fileURLToPath(new URL('../client', import.meta.url));

if (env.isProduction && env.SENTRY_DSN !== undefined) {
  // oxlint-disable-next-line unicorn/prefer-top-level-await -- sentry init is deliberately fire-and-forget so it never delays server startup
  void (async () => {
    const sentryModule = await import('./server/init-sentry-node');

    sentryModule.initSentryNode();
  })();
}

// playwright and local dev exercise auth routes far faster than a real user ever would; only
// production traffic gets the full strict budget
const RATE_LIMIT_MAX_MULTIPLE = env.isProduction ? 1 : 10_000;

const clientAssets = serveStatic({ dir: CLIENT_ASSETS_DIRECTORY });

/**
 * Serves the built client assets, falling through to `next` for anything that isn't a file on
 * disk (every SSR page and server function). Wrapped so its srvx-flavored signature — which
 * permits a synchronous `Response` — normalizes to this file's own `Middleware` return type.
 */
function serveClientAssets(request: Request, next: () => Promise<Response>): Promise<Response> {
  return Promise.resolve(clientAssets(request, next));
}

const serverEntry = {
  fetch: withMiddleware(
    [
      makeRequestLogger(logger),
      removeTrailingSlash,
      enforceHTTPS,
      makeSecureHeaders({ sentryEnabled: env.SENTRY_DSN !== undefined }),
      makeRateLimiter({ maxMultiple: RATE_LIMIT_MAX_MULTIPLE }),
      serveClientAssets,
    ],
    createStartHandler(defaultStreamHandler),
  ),
};

export default serverEntry;
