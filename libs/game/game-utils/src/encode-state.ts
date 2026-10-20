export function encodeState(words: ReadonlyArray<number>): string {
  return words
    .map((word) => {
      const unsigned = word >>> 0;

      return unsigned.toString(16).padStart(8, '0');
    })
    .join('');
}
