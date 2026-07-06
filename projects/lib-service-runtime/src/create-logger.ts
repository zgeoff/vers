import pino from 'pino';

interface CreateLoggerOptions {
  readonly level: string;
  readonly name: string;
}

/** Builds a service's pino logger: JSON lines to stdout, with `name` bound onto every entry. */
export function createLogger(options: CreateLoggerOptions): pino.Logger {
  return pino({ level: options.level, name: options.name });
}
