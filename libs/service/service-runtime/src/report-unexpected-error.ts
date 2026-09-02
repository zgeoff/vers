import { findTraceContext } from '@vers/service-utils';
import { sentryHandle } from './sentry-handle';

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
