import type { Logger } from 'pino';
import pino from 'pino';

export interface CreateLoggerOptions {
  level: string;
  pretty?: boolean;
  sentryDSN?: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
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

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (options.pretty) {
    targets.push(prettyTransport);
  } else {
    targets.push(defaultTransport);
  }

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (options.sentryDSN) {
    targets.push(sentryTransport);
  }

  // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
  const transport: pino.DestinationStream = pino.transport({
    level: options.level,
    targets,
  });

  return pino(transport);
}
