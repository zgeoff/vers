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
    ...(env.SENTRY_DSN !== undefined && { dsn: env.SENTRY_DSN }),
    environment: env.NODE_ENV,
    integrations: [Sentry.httpIntegration()],
    sendDefaultPii: true,

    // tracing lives on the OpenTelemetry path; the error backend drops transaction envelopes
    tracesSampleRate: 0,
  });
}
