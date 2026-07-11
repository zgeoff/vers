import type { Logger } from 'pino';
import pino from 'pino';
import { findTraceContext } from '../trace/find-trace-context';

interface CreateLoggerOptions {
  readonly level: pino.Level;
  readonly pretty?: boolean;
  readonly stream?: pino.DestinationStream;
}

/**
 * Builds a pino logger that stamps the active request's trace id onto every entry. Logging is the
 * only sink here — error reporting goes through the Sentry SDK at the error boundary, never a log
 * transport, so one error is never shipped twice. A `stream` is an additional destination written
 * beside stdout, for log shipping; it takes precedence over `pretty`, which is a stdout-only mode.
 */
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
