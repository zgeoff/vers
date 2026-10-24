export interface BackgroundDrains {
  readonly signal: AbortSignal;
  readonly track: <T>(work: Promise<T>) => Promise<T>;
  readonly stop: (timeoutMs: number) => Promise<void>;
}

export function createBackgroundDrains(): BackgroundDrains {
  const controller = new AbortController();
  const inFlight = new Set<Promise<unknown>>();

  return {
    signal: controller.signal,
    track: (work) => {
      inFlight.add(work);
      void removeWhenSettled(inFlight, work);

      return work;
    },
    stop: async (timeoutMs) => {
      controller.abort();

      const timeout = Promise.withResolvers<void>();
      const timer = setTimeout(timeout.resolve, timeoutMs);

      await Promise.race([Promise.allSettled(inFlight), timeout.promise]);

      clearTimeout(timer);
    },
  };
}

async function removeWhenSettled(
  inFlight: Set<Promise<unknown>>,
  work: Promise<unknown>,
): Promise<void> {
  await Promise.allSettled([work]);

  inFlight.delete(work);
}
