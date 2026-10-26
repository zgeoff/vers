export function parseSeconds(value: string): number {
  const seconds = Number(value);

  if (value.trim() === '' || !Number.isFinite(seconds) || seconds < 0) {
    throw new Error(`expected a non-negative number of seconds, got "${value}"`);
  }

  return seconds;
}
