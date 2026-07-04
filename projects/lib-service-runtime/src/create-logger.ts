import pino from 'pino';

/** Builds a service's pino logger: JSON lines to stdout, with `name` bound onto every entry. */
export function createLogger(options: {
  level: string;
  name: string;
}): pino.Logger {
  return pino({ level: options.level, name: options.name });
}
