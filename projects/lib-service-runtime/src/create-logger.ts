import pino from 'pino';

interface CreateLoggerOptions {
  level: string;
  name: string;
}

/** Builds a service's pino logger: JSON lines to stdout, with `name` bound onto every entry. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function createLogger(options: CreateLoggerOptions): pino.Logger {
  return pino({ level: options.level, name: options.name });
}
