export function runIgnoringRejection(promise: Readonly<Promise<unknown>>): void {
  void (async () => {
    try {
      await promise;
    } catch {
      // best-effort: an aborted or failed call has no further action here
    }
  })();
}
