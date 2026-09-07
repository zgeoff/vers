import { InvalidArgumentError } from 'commander';

const ENDPOINT_PATTERN = /^(?<host>[^\s/:]+):(?<port>\d{1,5})$/;
const MAX_PORT = 65_535;

export function parseEndpoint(value: string): string {
  const port = Number(ENDPOINT_PATTERN.exec(value)?.groups?.['port']);

  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new InvalidArgumentError(
      `expected host:port with a port from 1 to ${MAX_PORT}, got "${value}"`,
    );
  }

  return value;
}
