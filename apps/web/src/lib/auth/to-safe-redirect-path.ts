// a bare leading-slash check is not enough: a protocol-relative `//evil.example` and its backslash
// variant `/\evil.example` both parse as an external origin in some browsers
export function toSafeRedirectPath(candidate: string | null | undefined, fallback: string): string {
  if (candidate === null || candidate === undefined || candidate === '') {
    return fallback;
  }

  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/\\')) {
    return fallback;
  }

  return candidate;
}
