import { fileURLToPath } from 'node:url';
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { serveStatic } from 'srvx/static';
import { env } from './server/env';
import { logger } from './server/logger';
import { makeRateLimiter } from './server/make-rate-limiter';
import { makeRequestLogger } from './server/make-request-logger';
import { makeSecureHeaders } from './server/make-secure-headers';
import { makeUmamiProxy } from './server/make-umami-proxy';
import { withMiddleware } from './server/middleware';
import { redirectToHTTPS } from './server/redirect-to-https';
import { removeTrailingSlash } from './server/remove-trailing-slash';
import { withRequestTrace } from './server/with-request-trace';

// resolved from this built file's own location (`dist/server/server.js`) rather than the
// process's cwd, since the root `server.mjs` shim and the Docker runtime image invoke this bundle
// from different working directories
const CLIENT_ASSETS_DIRECTORY = fileURLToPath(new URL('../client', import.meta.url));

// awaited so registration completes before the Sentry init below runs: the OpenTelemetry API
// keeps only the first global tracer/context/propagator registration per process, and Sentry's own
// OpenTelemetry bootstrap would otherwise win the race and shadow standard traceparent propagation
if (env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined) {
  const otelModule = await import('@vers/service-utils/otel');

  otelModule.startTraceExport({ serviceName: 'app-web' });
  otelModule.startMetricsExport({ serviceName: 'app-web' });
}

if (env.isProduction && env.SENTRY_DSN !== undefined) {
  // oxlint-disable-next-line unicorn/prefer-top-level-await -- sentry init is deliberately fire-and-forget so it never delays server startup
  void (async () => {
    const sentryModule = await import('./server/start-sentry-node');

    sentryModule.startSentryNode();
  })();
}

// playwright and local dev exercise auth routes far faster than a real user ever would; only
// production traffic gets the full strict budget
const RATE_LIMIT_MAX_MULTIPLE = env.isProduction ? 1 : 10_000;

// the browser posts error envelopes to the host of the DSN baked into the client bundle, so the
// CSP allows that origin — the same variable must be present at build and at runtime
const SENTRY_ORIGIN =
  env.VITE_SENTRY_DSN === undefined ? null : new URL(env.VITE_SENTRY_DSN).origin;

const clientAssets = serveStatic({ dir: CLIENT_ASSETS_DIRECTORY });

function serveClientAssets(request: Request, next: () => Promise<Response>): Promise<Response> {
  // srvx's `clientAssets` permits a synchronous `Response`; wrapping normalizes its return to
  // this file's own `Middleware` return type.
  return Promise.resolve(clientAssets(request, next));
}

const serverEntry = {
  fetch: withMiddleware(
    [
      // outermost so the request logger's lines already run inside the trace scope
      withRequestTrace,
      makeRequestLogger(logger),
      removeTrailingSlash,
      redirectToHTTPS,
      makeSecureHeaders({ sentryOrigin: SENTRY_ORIGIN }),
      makeRateLimiter({ maxMultiple: RATE_LIMIT_MAX_MULTIPLE }),
      makeUmamiProxy({ upstream: env.UMAMI_URL ?? null }),
      serveClientAssets,
    ],
    createStartHandler(defaultStreamHandler),
  ),
};

export default serverEntry;
