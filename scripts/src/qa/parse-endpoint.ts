import { InvalidArgumentError } from 'commander';

const ENDPOINT_PATTERN = /^[^\s/:]+:\d{1,5}$/;

export function parseEndpoint(value: string): string {
  if (!ENDPOINT_PATTERN.test(value)) {
    throw new InvalidArgumentError(`expected host:port, got "${value}"`);
  }

  return value;
}
