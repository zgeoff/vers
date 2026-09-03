export function isAbortError(error: unknown, signal: AbortSignal): boolean {
  if (!signal.aborted) {
    return false;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  return error === signal.reason;
}
