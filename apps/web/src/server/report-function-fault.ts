import * as Sentry from '@sentry/node';
import { findTraceContext } from '@vers/service-utils';

interface FaultLoggerSink {
  readonly error: (fields: Readonly<Record<string, unknown>>, message: string) => void;
}

export function reportFunctionFault(error: unknown, logger: FaultLoggerSink): void {
  logger.error({ err: error }, 'server function failed');

  Sentry.withScope((scope) => {
    const trace = findTraceContext();

    if (trace !== undefined) {
      scope.setTag('traceID', trace.traceID);
    }

    Sentry.captureException(error);
  });
}
