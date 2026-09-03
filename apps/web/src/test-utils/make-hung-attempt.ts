export function makeHungAttempt(): (signal: AbortSignal) => Promise<Response> {
  return (signal) =>
    new Promise<Response>((_resolve, reject) => {
      const rejectWithReason = (): void => {
        const reason: unknown = signal.reason;
        const error = reason instanceof Error ? reason : new Error(String(reason));

        reject(error);
      };

      if (signal.aborted) {
        rejectWithReason();

        return;
      }

      signal.addEventListener('abort', rejectWithReason, { once: true });
    });
}
