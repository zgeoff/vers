import * as Sentry from '@sentry/node';
import type { NodeOptions } from '@sentry/node';
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

    // on, the SDK gives a captured message a synthetic stack of the capture site, which splits its
    // issue group in the error backend
    attachStacktrace: false,

    // tracing lives on the OpenTelemetry path: with no `tracesSampleRate` the SDK opens no spans of
    // its own, and the OpenTelemetry integration puts the active span's trace on each event
    integrations: [Sentry.httpIntegration(), Sentry.openTelemetryIntegration()],

    // the SDK collects cookies and every HTTP body type by default, and its name filter misses some
    // of the session cookies, while a login or sign-up body carries the password
    dataCollection: { cookies: false, httpBodies: [], userInfo: true },

    // the error backend discards client reports, and their 60s flush keeps otherwise idle
    // infrastructure awake
    sendClientReports: false,
    ...(options.beforeSend !== undefined && { beforeSend: options.beforeSend }),
    ...(options.disableDefaultIntegrations === true && { defaultIntegrations: false }),
  });
}
