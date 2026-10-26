import * as Sentry from '@sentry/node';
import { findTraceContext } from '@vers/service-utils';

interface FaultLoggerSink {
  readonly error: (message: string, properties: Readonly<Record<string, unknown>>) => void;
}

export function reportFunctionFault(error: unknown, logger: FaultLoggerSink): void {
  logger.error('server function failed', { error });

  const trace = findTraceContext();

  if (trace === undefined) {
    Sentry.captureException(error);
  } else {
    Sentry.captureException(error, { tags: { traceID: trace.traceID } });
  }
}
