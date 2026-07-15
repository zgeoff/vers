interface WaitForOptions {
  /**
   * Milliseconds between retries.
   */
  readonly intervalMs?: number;

  /**
   * Milliseconds before the wait gives up.
   */
  readonly timeoutMs?: number;
}

/**
 * Retries the attempt until it stops throwing or rejecting, resolving with its value — so
 * assertion-style checks read exactly as they would in a straight-line test body. Once the
 * deadline passes, the attempt's final failure is rethrown as the wait's rejection.
 */
export async function waitFor<T>(
  attempt: () => Promise<T> | T,
  options: Readonly<WaitForOptions> = {},
): Promise<T> {
  const intervalMs = options.intervalMs ?? 50;
  const timeoutMs = options.timeoutMs ?? 1000;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      return await attempt();
    } catch (error) {
      if (Date.now() >= deadline) {
        throw error;
      }
    }

    await Bun.sleep(intervalMs);
  }
}
