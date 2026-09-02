const IGNORE_FLAG_PATTERN = /--ignore=(?<id>\S+)/g;

export function parseIgnoredAdvisories(auditScript: string): Array<string> {
  return [...auditScript.matchAll(IGNORE_FLAG_PATTERN)].map((match) => match.groups?.['id'] ?? '');
}
