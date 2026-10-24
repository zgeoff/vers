import { context } from '@opentelemetry/api';
import type { BunOptions } from '@sentry/bun';
import invariant from 'tiny-invariant';
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

  // the Bun SDK re-exports no SentryContextManager; it wraps this same Node SDK, which owns the class
  const [sentry, { SentryContextManager }] = await Promise.all([
    import('@sentry/bun'),
    import('@sentry/node'),
  ]);

  sentryHandle.current = sentry;

  sentry.init({
    dsn,

    // an explicit `dataCollection` makes the SDK's spec defaults the base, which collect every
    // HTTP body type — and a failed request's body can carry credentials or tokens, so body
    // capture is switched off wholesale
    dataCollection: { httpBodies: [], userInfo: true },
    tracesSampleRate: 0,

    // the error backend discards transaction envelopes and client reports, and the client-report
    // flush every 60s keeps an otherwise idle machine awake
    sendClientReports: false,

    // the SDK's own setup would register its tracer provider and a propagator that reads no
    // `traceparent`, and the OpenTelemetry API keeps the first registration of each
    skipOpenTelemetrySetup: true,
    ...(options.beforeSend !== undefined && { beforeSend: options.beforeSend }),
    ...(options.disableDefaultIntegrations === true && { defaultIntegrations: [] }),
  });

  // the SDK forks a request's scope only through this context manager, and the API keeps the first
  // one registered, so the OTel plugin's default must not have claimed the slot already
  invariant(
    context.setGlobalContextManager(new SentryContextManager().enable()),
    'error reporting starts before any other OpenTelemetry context manager registers',
  );
}
