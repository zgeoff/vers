interface WaitForOptions {
  readonly intervalMs?: number;

  readonly timeoutMs?: number;
}

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
