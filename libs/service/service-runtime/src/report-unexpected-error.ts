import { findTraceContext } from '@vers/service-utils';
import { sentryHandle } from './sentry-handle';

export function reportUnexpectedError(error: unknown): void {
  const sentry = sentryHandle.current;

  if (sentry === undefined) {
    return;
  }

  const trace = findTraceContext();

  if (trace === undefined) {
    sentry.captureException(error);
  } else {
    sentry.captureException(error, { tags: { traceID: trace.traceID } });
  }
}
