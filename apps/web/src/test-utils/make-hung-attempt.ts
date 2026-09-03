export function makeHungAttempt(): (signal: AbortSignal) => Promise<Response> {
  return (signal) =>
    new Promise<Response>((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          const reason: unknown = signal.reason;
          const error = reason instanceof Error ? reason : new Error(String(reason));

          reject(error);
        },
        { once: true },
      );
    });
}
