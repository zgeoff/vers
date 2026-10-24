import * as Sentry from '@sentry/node';
import { findTraceContext } from '@vers/service-utils';

interface FaultLoggerSink {
  readonly error: (fields: Readonly<Record<string, unknown>>, message: string) => void;
}

export function reportFunctionFault(error: unknown, logger: FaultLoggerSink): void {
  logger.error({ err: error }, 'server function failed');

  const trace = findTraceContext();

  // tagged per event, never through a forked scope: with the trace exporter's context manager
  // registered before Sentry's, the SDK's withScope does not fork, so a scope tag outlives the call
  if (trace === undefined) {
    Sentry.captureException(error);
  } else {
    Sentry.captureException(error, { tags: { traceID: trace.traceID } });
  }
}
