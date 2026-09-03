export function encodeState(words: ReadonlyArray<number>): string {
  return words
    .map((word) => {
      // oxlint-disable-next-line unicorn/prefer-math-trunc -- reinterprets a signed 32-bit int as unsigned; Math.trunc only drops a fractional part, it doesn't clear the sign bit
      const unsigned = word >>> 0;

      return unsigned.toString(16).padStart(8, '0');
    })
    .join('');
}
