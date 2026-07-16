import { findTraceContext } from '@vers/service-utils';
import { sentryHandle } from './sentry-handle';

/**
 * Reports an unexpected failure to the error backend, tagging it with the active trace id when
 * called inside a `withTraceContext` scope. No-op when `startErrorReporting` never ran (no DSN
 * configured), so this is safe to call unconditionally from every swallow point.
 */
export function reportUnexpectedError(error: unknown): void {
  const sentry = sentryHandle.current;

  if (sentry === undefined) {
    return;
  }

  sentry.withScope((scope) => {
    const trace = findTraceContext();

    if (trace !== undefined) {
      scope.setTag('traceID', trace.traceID);
    }

    sentry.captureException(error);
  });
}
