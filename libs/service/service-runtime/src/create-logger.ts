import { findTraceContext } from '@vers/service-utils';
import pino from 'pino';

interface CreateLoggerOptions {
  readonly level: pino.Level;
  readonly name: string;
  readonly stream?: pino.DestinationStream;
}

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
