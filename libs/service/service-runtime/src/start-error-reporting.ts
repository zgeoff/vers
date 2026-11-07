import type { BunOptions } from '@sentry/bun';
import { sentryHandle } from './sentry-handle';

export interface StartErrorReportingOptions {
  readonly beforeSend?: BunOptions['beforeSend'];

  // test-only: the SDK's default integrations install global uncaughtException and
  // unhandledRejection handlers plus session auto-tracking, which would leak into a shared test run
  readonly disableDefaultIntegrations?: boolean;
}

export async function startErrorReporting(
  dsn: string | undefined,
  options: Readonly<StartErrorReportingOptions> = {},
): Promise<void> {
  if (dsn === undefined) {
    return;
  }

  const sentry = await import('@sentry/bun');

  sentryHandle.current = sentry;

  sentry.init({
    dsn,

    // on, the SDK gives an event from a non-Error value a synthetic stack of the capture site, which
    // splits its issue group in the error backend
    attachStacktrace: false,

    // an explicit `dataCollection` makes the SDK's spec defaults the base, which collect every
    // HTTP body type — and a failed request's body can carry credentials or tokens, so body
    // capture is switched off wholesale
    dataCollection: { httpBodies: [], userInfo: true },

    // tracing lives on the OpenTelemetry path: with no `tracesSampleRate` the SDK opens no spans of
    // its own, and this integration puts the active OpenTelemetry span's trace on each event
    integrations: [sentry.openTelemetryIntegration()],

    // the error backend discards transaction envelopes and client reports, and the client-report
    // flush every 60s keeps an otherwise idle machine awake
    sendClientReports: false,
    ...(options.beforeSend !== undefined && { beforeSend: options.beforeSend }),
    ...(options.disableDefaultIntegrations === true && { defaultIntegrations: [] }),
  });
}
