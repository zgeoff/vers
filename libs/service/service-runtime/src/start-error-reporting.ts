import type { BunOptions } from '@sentry/bun';
import { sentryHandle } from './sentry-handle';

export interface StartErrorReportingOptions {
  /**
   * Test-only hook: intercepts every event just before send, letting a suite record and suppress
   * delivery without a live DSN destination.
   */
  readonly beforeSend?: BunOptions['beforeSend'];

  /**
   * Test-only override: when true, passes `defaultIntegrations: []` to the SDK, suppressing its
   * default integration set — which installs global `uncaughtException`/`unhandledRejection`
   * process handlers and session auto-tracking — so a suite that starts real reporting never
   * leaks global process listeners or background network activity into the shared test run.
   */
  readonly disableDefaultIntegrations?: boolean;
}

/**
 * Initializes the Sentry SDK that `reportUnexpectedError` and `flushErrorReports` capture
 * through. A no-op when `dsn` is undefined, so a DSN-less process never loads the SDK. Tracing
 * lives on the OpenTelemetry path; the error backend drops transaction envelopes. Client reports
 * are off: the error backend discards them, and their 60s flush keeps otherwise idle
 * infrastructure awake.
 */
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

    // an explicit `dataCollection` makes the SDK's spec defaults the base, which collect every
    // HTTP body type — and a failed request's body can carry credentials or tokens, so body
    // capture is switched off wholesale
    dataCollection: { httpBodies: [], userInfo: true },
    tracesSampleRate: 0,
    sendClientReports: false,
    ...(options.beforeSend !== undefined && { beforeSend: options.beforeSend }),
    ...(options.disableDefaultIntegrations === true && { defaultIntegrations: [] }),
  });
}
