import { sentryHandle } from './sentry-handle';

export type WorkerFaultSite =
  | 'checkpoint-flush'
  | 'checkpoint-stream'
  | 'continuation'
  | 'eviction'
  | 'message-routing'
  | 'preference-seed'
  | 'writer-election'
  | 'reconnect'
  | 'resync'
  | 'start'
  | 'tick-loop';

export function reportWorkerFault(
  site: WorkerFaultSite,
  error: unknown,
  tags?: Readonly<Record<string, string>>,
): void {
  const sentry = sentryHandle.current;

  if (sentry === undefined) {
    return;
  }

  sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(tags ?? {})) {
      scope.setTag(key, value);
    }

    // set last so a caller's tags can never overwrite the capture site
    scope.setTag('site', site);
    sentry.captureException(error);
  });
}
