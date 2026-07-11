import { findTraceContext } from '@vers/service-utils';
import pino from 'pino';

interface CreateLoggerOptions {
  readonly level: pino.Level;
  readonly name: string;
  readonly stream?: pino.DestinationStream;
}

/**
 * Builds a service's pino logger: JSON lines to stdout, with `name` bound onto every entry and the
 * active request's trace id mixed into every line written inside a trace-context scope. A `stream`
 * is an additional destination written beside stdout, for log shipping.
 */
export function createLogger(options: CreateLoggerOptions): pino.Logger {
  const baseOptions: pino.LoggerOptions = {
    level: options.level,
    mixin: () => {
      const trace = findTraceContext();

      return trace === undefined ? {} : { traceID: trace.traceID };
    },
    name: options.name,
  };

  if (options.stream === undefined) {
    return pino(baseOptions);
  }

  return pino(
    baseOptions,
    pino.multistream([
      { level: options.level, stream: pino.destination(1) },
      { level: options.level, stream: options.stream },
    ]),
  );
}
