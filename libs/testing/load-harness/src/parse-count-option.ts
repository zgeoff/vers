export function parseCountOption(value: string): number {
  const parsed = Number(value);

  if (value.trim() === '' || !Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`expected a whole number of at least 1, got "${value}"`);
  }

  return parsed;
}
