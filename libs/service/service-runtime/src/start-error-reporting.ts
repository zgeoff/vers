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

    // an explicit `dataCollection` makes the SDK's spec defaults the base, which collect every
    // HTTP body type — and a failed request's body can carry credentials or tokens, so body
    // capture is switched off wholesale
    dataCollection: { httpBodies: [], userInfo: true },
    tracesSampleRate: 0,

    // the error backend discards transaction envelopes and client reports, and the client-report
    // flush every 60s keeps an otherwise idle machine awake
    sendClientReports: false,
    ...(options.beforeSend !== undefined && { beforeSend: options.beforeSend }),
    ...(options.disableDefaultIntegrations === true && { defaultIntegrations: [] }),
  });
}
