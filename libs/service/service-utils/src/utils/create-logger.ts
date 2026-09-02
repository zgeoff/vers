import type { Logger } from 'pino';
import pino from 'pino';
import { findTraceContext } from '../trace/find-trace-context';

interface CreateLoggerOptions {
  readonly level: pino.Level;
  readonly pretty?: boolean;
  readonly stream?: pino.DestinationStream;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const baseOptions: pino.LoggerOptions = {
    level: options.level,
    mixin: () => {
      const trace = findTraceContext();

      return trace === undefined ? {} : { traceID: trace.traceID };
    },
  };

  if (options.stream !== undefined) {
    return pino(
      baseOptions,
      pino.multistream([
        { level: options.level, stream: pino.destination(1) },
        { level: options.level, stream: options.stream },
      ]),
    );
  }

  const prettyTransport: pino.TransportTargetOptions = {
    options: {
      colorize: true,
      ignore: 'pid,hostname,response',
    },
    target: 'pino-pretty',
  };

  return pino({
    ...baseOptions,
    ...(options.pretty === true && { transport: { targets: [prettyTransport] } }),
  });
}
