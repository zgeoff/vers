import { sentryHandle } from './sentry-handle';

export type WorkerFaultSite = 'message-routing' | 'reconnect' | 'resync' | 'tick-loop';

/**
 * Forwards a worker fault to the error backend, tagged with the capture site so a tick-loop crash
 * groups apart from a resync failure. No-op when `startErrorReporting` never ran (no DSN
 * configured), so this is safe to call unconditionally from every swallow point.
 */
export function reportWorkerFault(site: WorkerFaultSite, error: unknown): void {
  const sentry = sentryHandle.current;

  if (sentry === undefined) {
    return;
  }

  sentry.withScope((scope) => {
    scope.setTag('site', site);
    sentry.captureException(error);
  });
}
