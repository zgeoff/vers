import type { Logger } from 'pino';
import pino from 'pino';
import { findTraceContext } from '../trace/find-trace-context';

interface CreateLoggerOptions {
  readonly level: string;
  readonly pretty?: boolean;
}

/**
 * Builds a pino logger that stamps the active request's trace id onto every entry. Logging is the
 * only sink here — error reporting goes through the Sentry SDK at the error boundary, never a log
 * transport, so one error is never shipped twice.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const prettyTransport: pino.TransportTargetOptions = {
    options: {
      colorize: true,
      ignore: 'pid,hostname,response',
    },
    target: 'pino-pretty',
  };

  return pino({
    level: options.level,
    mixin: () => {
      const trace = findTraceContext();

      return trace === undefined ? {} : { traceID: trace.traceID };
    },
    ...(options.pretty === true && { transport: { targets: [prettyTransport] } }),
  });
}
