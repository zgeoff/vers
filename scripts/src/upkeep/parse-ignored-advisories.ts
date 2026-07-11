const IGNORE_FLAG_PATTERN = /--ignore=(?<id>\S+)/g;

/**
 * Collects the GHSA ids the root manifest's audit script suppresses, so the
 * sweep can flag any that no longer match a live advisory.
 */
export function parseIgnoredAdvisories(auditScript: string): Array<string> {
  return [...auditScript.matchAll(IGNORE_FLAG_PATTERN)].map((match) => match.groups?.['id'] ?? '');
}
