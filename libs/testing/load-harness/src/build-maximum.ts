// a reduce rather than a spread into Math.max, which overflows the call stack on the hundreds of
// thousands of samples a long return records
export function buildMaximum(values: ReadonlyArray<number>): number {
  return values.reduce((maximum, value) => Math.max(maximum, value), 0);
}
