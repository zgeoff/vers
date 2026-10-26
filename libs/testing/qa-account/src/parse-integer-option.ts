export function parseIntegerOption(value: string, minimum: number): number {
  const parsed = Number(value);

  if (value.trim() === '' || !Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(`expected an integer of at least ${minimum}, got "${value}"`);
  }

  return parsed;
}
