// 1. combine seeds using a bitwise XOR (^)
// 2. multiply by novel large magic number
// 3. ensure result is 32-bit unsigned integer via >>>0
export function mergeSeeds(a: number, b: number): number {
  return Math.trunc((a ^ b) * 0xdeadbeef);
}
