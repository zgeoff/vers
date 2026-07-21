/**
 * Runs an already-in-flight promise to completion, discarding a rejection — the fire-and-forget
 * idiom every idle sender call site needs: a writer-generation abort rejects the call, and there is
 * nothing further for the caller to do about it.
 */
export function runIgnoringRejection(promise: Readonly<Promise<unknown>>): void {
  void (async () => {
    try {
      await promise;
    } catch {
      // best-effort: an aborted or failed call has no further action here
    }
  })();
}
