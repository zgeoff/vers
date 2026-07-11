interface RetryOptions {
  readonly attempts: number;
  readonly delayMS: number;
}

/**
 * Runs the callback until it resolves, retrying on rejection up to `attempts`
 * total runs with `delayMS` between them; the final rejection propagates.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: Error = new Error('retry callback never ran');

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < options.attempts) {
        await Bun.sleep(options.delayMS);
      }
    }
  }

  throw lastError;
}
