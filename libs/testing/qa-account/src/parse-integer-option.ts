import { InvalidArgumentError } from 'commander';

export function parseIntegerOption(value: string, minimum: number): number {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new InvalidArgumentError(`expected an integer of at least ${minimum}`);
  }

  return parsed;
}
