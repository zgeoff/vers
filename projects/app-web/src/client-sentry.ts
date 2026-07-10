import * as Sentry from '@sentry/react';

/**
 * Initializes browser-side error reporting. No-ops without `VITE_SENTRY_DSN` — the browser can
 * only read `VITE_`-prefixed env vars, so the client DSN is configured separately from the
 * server's `SENTRY_DSN`.
 */
export function initSentryReact(): void {
  const dsn: string | undefined = import.meta.env['VITE_SENTRY_DSN'];

  if (dsn === undefined) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: true,

    // tracing lives on the OpenTelemetry path; the error backend drops transaction envelopes
    tracesSampleRate: 0,
  });
}
