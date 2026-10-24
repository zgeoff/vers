import { findTraceContext } from '@vers/service-utils';
import { sentryHandle } from './sentry-handle';

export function reportUnexpectedError(error: unknown): void {
  const sentry = sentryHandle.current;

  if (sentry === undefined) {
    return;
  }

  const trace = findTraceContext();

  // tagged per event, never through a forked scope: with the OTel plugin's context manager
  // registered before Sentry's, the SDK's withScope does not fork, so a scope tag outlives the call
  if (trace === undefined) {
    sentry.captureException(error);
  } else {
    sentry.captureException(error, { tags: { traceID: trace.traceID } });
  }
}
