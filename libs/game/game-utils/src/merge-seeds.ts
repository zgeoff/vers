/**
 * Combines two seeds by XORing them and multiplying by a fixed large constant,
 * truncating the fractional part of the product.
 */
export function mergeSeeds(a: number, b: number): number {
  return Math.trunc((a ^ b) * 0xdeadbeef);
}
