import type { BrowserOptions } from '@sentry/browser';
import { sentryHandle } from './sentry-handle';

export interface StartErrorReportingOptions {
  readonly beforeSend?: BrowserOptions['beforeSend'];

  // the SDK's default integrations install `error`/`unhandledrejection` handlers on the worker's
  // global scope, which would leak into the shared test run
  readonly disableDefaultIntegrations?: boolean;

  readonly environment?: string;
}

export async function startErrorReporting(
  dsn: string | undefined,
  options: Readonly<StartErrorReportingOptions> = {},
): Promise<void> {
  if (dsn === undefined) {
    return;
  }

  try {
    const sentry = await import('@sentry/browser');

    sentry.init({
      dsn,

      // an explicit `dataCollection` makes the SDK's spec defaults the base, which collect every
      // HTTP body type — and a failed checkpoint submission's body carries the session token, so
      // body capture is switched off wholesale
      dataCollection: { httpBodies: [], userInfo: true },

      // Tracing lives on the OpenTelemetry path; the error backend drops transaction envelopes.
      tracesSampleRate: 0,

      // The error backend discards client reports, and their periodic flush would keep an idle
      // worker chattering.
      sendClientReports: false,
      ...(options.beforeSend !== undefined && { beforeSend: options.beforeSend }),
      ...(options.disableDefaultIntegrations === true && { defaultIntegrations: false }),
      ...(options.environment !== undefined && { environment: options.environment }),
    });

    // published only after a successful init: a failure above leaves the handle undefined, so
    // fault reporting keeps its no-op path instead of capturing through a dead SDK
    sentryHandle.current = sentry;
  } catch (error) {
    console.warn('error reporting failed to start', error);
  }
}
