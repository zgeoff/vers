import type { BrowserOptions } from '@sentry/browser';
import { sentryHandle } from './sentry-handle';

export interface StartErrorReportingOptions {
  /**
   * Test-only hook: intercepts every event just before send, letting a suite record and suppress
   * delivery without a live DSN destination.
   */
  readonly beforeSend?: BrowserOptions['beforeSend'];

  /**
   * Test-only override: when true, passes `defaultIntegrations: false` to the SDK, suppressing
   * its default integration set — which installs `error`/`unhandledrejection` handlers on the
   * worker's global scope — so a suite that starts real reporting never leaks global listeners
   * into the shared test run.
   */
  readonly disableDefaultIntegrations?: boolean;

  /**
   * Deploy environment stamped on every event; the worker's production wiring passes the build
   * mode.
   */
  readonly environment?: string;
}

/**
 * Initializes the Sentry SDK that `reportWorkerFault` captures through, inside the shared
 * worker's own scope — capture must not depend on a window client being connected, since a worker
 * can fault with every tab gone. A no-op when `dsn` is undefined, so a DSN-less worker never
 * loads the SDK. The SDK's default global handlers stay on in production, netting any throw the
 * explicit capture sites miss. Tracing lives on the OpenTelemetry path; the error backend drops
 * transaction envelopes. Client reports are off: the error backend discards them, and their
 * periodic flush would keep an idle worker chattering.
 */
export async function startErrorReporting(
  dsn: string | undefined,
  options: Readonly<StartErrorReportingOptions> = {},
): Promise<void> {
  if (dsn === undefined) {
    return;
  }

  const sentry = await import('@sentry/browser');

  sentryHandle.current = sentry;

  sentry.init({
    dsn,

    // an explicit `dataCollection` makes the SDK's spec defaults the base, which collect every
    // HTTP body type — and a failed checkpoint submission's body carries the session token, so
    // body capture is switched off wholesale
    dataCollection: { httpBodies: [], userInfo: true },
    tracesSampleRate: 0,
    sendClientReports: false,
    ...(options.beforeSend !== undefined && { beforeSend: options.beforeSend }),
    ...(options.disableDefaultIntegrations === true && { defaultIntegrations: false }),
    ...(options.environment !== undefined && { environment: options.environment }),
  });
}
