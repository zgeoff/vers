import { sentryHandle } from './sentry-handle';

/**
 * Bounds the flush so an exit path never hangs on an unreachable error backend — delivery is
 * best-effort; past the deadline the process exits with whatever made it out.
 */
const FLUSH_TIMEOUT_MS = 2000;

/**
 * Awaits delivery of every report queued so far, resolving `true` when the queue drained (or there
 * was nothing to flush — including when `startErrorReporting` never ran) and `false` when the
 * timeout elapsed with reports still queued. Callers that report an error immediately before
 * `process.exit` need this — otherwise the event dies with the process before Sentry's background
 * flush gets to run.
 */
export function flushErrorReports(): Promise<boolean> {
  if (sentryHandle.current === undefined) {
    return Promise.resolve(true);
  }

  return sentryHandle.current.flush(FLUSH_TIMEOUT_MS);
}
