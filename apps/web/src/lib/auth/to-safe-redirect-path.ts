/**
 * Normalizes a caller-supplied redirect target to a same-origin path, falling back otherwise.
 * Blocks the open-redirect tricks a bare `startsWith('/')` check misses: a protocol-relative
 * `//evil.example` and a backslash variant `/\evil.example` both parse as an external origin in
 * some browsers despite "starting with a slash".
 */
export function toSafeRedirectPath(candidate: string | null | undefined, fallback: string): string {
  if (candidate === null || candidate === undefined || candidate === '') {
    return fallback;
  }

  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/\\')) {
    return fallback;
  }

  return candidate;
}
