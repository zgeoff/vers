import { sentryHandle } from './sentry-handle';

export type WorkerFaultSite =
  | 'continuation'
  | 'message-routing'
  | 'preference-seed'
  | 'reconnect'
  | 'resync'
  | 'start'
  | 'tick-loop';

/**
 * Forwards a worker fault to the error backend, tagged with the capture site that caught it —
 * grouping stays stack-based, so one defect reached from two sites is still one issue. No-op when
 * `startErrorReporting` never ran (no DSN configured), so this is safe to call unconditionally
 * from every swallow point.
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
