import { fileURLToPath } from 'node:url';
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { startMetricsExport, startTraceExport } from '@vers/service-utils/otel';
import { staticMiddleware } from 'srvx/static';
import { env } from './server/env';
import { logger } from './server/logger';
import { makeRateLimiter } from './server/make-rate-limiter';
import { makeRequestLogger } from './server/make-request-logger';
import { makeSecureHeaders } from './server/make-secure-headers';
import { makeUmamiProxy } from './server/make-umami-proxy';
import { withMiddleware } from './server/middleware';
import { recoverFailedRequest } from './server/recover-failed-request';
import { redirectToHTTPS } from './server/redirect-to-https';
import { rejectNonHTMLAccept } from './server/reject-non-html-accept';
import { removeTrailingSlash } from './server/remove-trailing-slash';
import { startSentryNode } from './server/start-sentry-node';
import { withRequestTrace } from './server/with-request-trace';

// static imports, never a top-level `await import()`: rolldown can fold a chunk into this entry that
// imports it back, and Node exits 13 on the unsettled cycle. Sentry starts first so the API keeps
// its context manager, the one that gives each request its own scope.
if (env.isProduction && env.SENTRY_DSN !== undefined) {
  startSentryNode(env.SENTRY_DSN);
}

if (env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined) {
  startTraceExport({ serviceName: 'app-web' });
  startMetricsExport({ serviceName: 'app-web' });
}

// playwright and local dev exercise auth routes far faster than a real user ever would; only
// production traffic gets the full strict budget
const RATE_LIMIT_MAX_MULTIPLE = env.isProduction ? 1 : 10_000;

// the browser posts error envelopes to the host of the DSN baked into the client bundle, so the
// CSP allows that origin — the same variable must be present at build and at runtime
const SENTRY_ORIGIN =
  env.VITE_SENTRY_DSN === undefined ? null : new URL(env.VITE_SENTRY_DSN).origin;

const serverEntry = {
  fetch: withMiddleware(
    [
      // outermost so a rejection from any later step still becomes a response
      recoverFailedRequest,

      // ahead of the request logger so its lines already run inside the trace scope
      withRequestTrace,
      makeRequestLogger(logger),
      removeTrailingSlash,
      redirectToHTTPS,
      makeSecureHeaders({ sentryOrigin: SENTRY_ORIGIN }),
      makeRateLimiter({ maxMultiple: RATE_LIMIT_MAX_MULTIPLE }),
      makeUmamiProxy({ upstream: env.UMAMI_URL ?? null }),
      serveClientAssets,

      // last, so only a request bound for a route reaches it
      rejectNonHTMLAccept,
    ],
    createStartHandler(defaultStreamHandler),
  ),
};

export default serverEntry;

// resolved from this built file's own location (`dist/server/server.js`) rather than the
// process's cwd, since the root `server.mjs` shim and the Docker runtime image invoke this bundle
// from different working directories
const CLIENT_ASSETS_DIRECTORY = fileURLToPath(new URL('../client', import.meta.url));

// oxlint-disable-next-line zgeoff/no-abbreviated-names -- srvx names the option `dir`
const clientAssets = staticMiddleware({ dir: CLIENT_ASSETS_DIRECTORY });

function serveClientAssets(request: Request, next: () => Promise<Response>): Promise<Response> {
  // srvx's `clientAssets` permits a synchronous `Response`; wrapping normalizes its return to
  // this file's own `Middleware` return type.
  return Promise.resolve(clientAssets(request, next));
}
