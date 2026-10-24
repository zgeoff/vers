import { context } from '@opentelemetry/api';
import * as Sentry from '@sentry/node';
import type { NodeOptions } from '@sentry/node';
import invariant from 'tiny-invariant';
import { env } from './env';

interface StartSentryNodeOptions {
  readonly beforeSend?: NodeOptions['beforeSend'];

  // test-only: the SDK's default integrations install global uncaughtException and
  // unhandledRejection handlers plus session auto-tracking, which would leak into a shared test run
  readonly disableDefaultIntegrations?: boolean;
}

// no `@sentry/profiling-node`: its native per-platform bindings cannot be bundled by the SSR build
export function startSentryNode(dsn: string, options: Readonly<StartSentryNodeOptions> = {}): void {
  Sentry.init({
    dsn,
    environment: env.NODE_ENV,
    integrations: [Sentry.httpIntegration()],

    // userInfo defaults off; the other categories default on once dataCollection is present,
    // matching what sendDefaultPii: true collected
    dataCollection: { userInfo: true },

    // tracing lives on the OpenTelemetry path; the error backend drops transaction envelopes
    tracesSampleRate: 0,

    // the error backend discards client reports, and their 60s flush keeps otherwise idle
    // infrastructure awake
    sendClientReports: false,

    // the SDK's own setup would register its tracer provider and a propagator that reads no
    // `traceparent`, and the OpenTelemetry API keeps the first registration of each
    skipOpenTelemetrySetup: true,
    ...(options.beforeSend !== undefined && { beforeSend: options.beforeSend }),
    ...(options.disableDefaultIntegrations === true && { defaultIntegrations: false }),
  });

  // the SDK forks a request's scope only through this context manager, and the API keeps the first
  // one registered, so the trace exporter's default must not have claimed the slot already
  invariant(
    context.setGlobalContextManager(new Sentry.SentryContextManager().enable()),
    'Sentry starts before any other OpenTelemetry context manager registers',
  );
}
