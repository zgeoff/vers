/**
 * Whether `error` is the given signal's own abort — either the platform's `AbortError`
 * `DOMException` or the exact value the signal aborted with as its `reason`. A caller filters an
 * abort at a flow boundary so a deliberate cancellation never reports as a worker fault.
 */
export function isAbortError(error: unknown, signal: AbortSignal): boolean {
  if (!signal.aborted) {
    return false;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  return error === signal.reason;
}
