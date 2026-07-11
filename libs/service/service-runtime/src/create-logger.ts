import { findTraceContext } from '@vers/service-utils';
import pino from 'pino';

interface CreateLoggerOptions {
  readonly level: string;
  readonly name: string;
}

/**
 * Builds a service's pino logger: JSON lines to stdout, with `name` bound onto every entry and the
 * active request's trace id mixed into every line written inside a trace-context scope.
 */
export function createLogger(options: CreateLoggerOptions): pino.Logger {
  return pino({
    level: options.level,
    mixin: () => {
      const trace = findTraceContext();

      return trace === undefined ? {} : { traceID: trace.traceID };
    },
    name: options.name,
  });
}
