import * as Sentry from '@sentry/node';
import { env } from './env';

/**
 * Initializes server-side error reporting. Callers guard this behind `env.SENTRY_DSN` — Sentry's
 * own SDK still no-ops without a DSN, but skipping the call entirely avoids paying its startup
 * cost (HTTP instrumentation) when reporting isn't configured. Skips `@sentry/profiling-node`: its
 * native per-platform bindings aren't bundleable by the SSR build.
 */
export function initSentryNode(): void {
  Sentry.init({
    beforeSendTransaction(event) {
      if (event.request?.headers?.['x-healthcheck'] === 'true') {
        return null;
      }

      return event;
    },
    denyUrls: [/\/health/, /\/assets\//],
    ...(env.SENTRY_DSN !== undefined && { dsn: env.SENTRY_DSN }),
    environment: env.NODE_ENV,
    integrations: [Sentry.httpIntegration()],
    tracesSampleRate: env.isProduction ? 1 : 0,
  });
}
