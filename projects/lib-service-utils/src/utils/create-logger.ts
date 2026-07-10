import type { Logger } from 'pino';
import pino from 'pino';

interface CreateLoggerOptions {
  readonly level: string;
  readonly pretty?: boolean;
  readonly sentryDSN?: string;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const sentryTransport: pino.TransportTargetOptions = {
    options: {
      dsn: options.sentryDSN,
      minLevel: 40,
    },
    target: 'pino-sentry-transport',
  };

  const defaultTransport: pino.TransportTargetOptions = {
    options: {
      // this writes to STDOUT
      destination: 1,
    },
    target: 'pino/file',
  };

  const prettyTransport: pino.TransportTargetOptions = {
    options: {
      colorize: true,
      ignore: 'pid,hostname,requestID,response',
    },
    target: 'pino-pretty',
  };

  const targets: Array<pino.TransportTargetOptions> = [];

  if (options.pretty === true) {
    targets.push(prettyTransport);
  } else {
    targets.push(defaultTransport);
  }

  if (options.sentryDSN !== undefined) {
    targets.push(sentryTransport);
  }

  return pino({
    level: options.level,
    transport: { targets },
  });
}
