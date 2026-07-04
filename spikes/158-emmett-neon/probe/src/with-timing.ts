/** Runs the callback and reports its wall-clock duration in milliseconds. */
export async function withTiming<T>(callback: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await callback();
  return { result, ms: performance.now() - start };
}
