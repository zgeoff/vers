import { buildHeadingPattern } from './build-heading-pattern';

/**
 * Matches a repository path: any token under a source root, or any token naming a source file by
 * its extension. Documentation and workflow paths are left out — the rule guards against a rename
 * stranding a reference, and those two rename rarely enough that flagging them costs more noise
 * than it saves.
 */
const PATH_PATTERN =
  /[\w./-]*[\w-]\.(?:tsx?|jsx?|css|json|ya?ml|sh|sql)\b|(?:apps|contracts|infra|libs|scripts|services)\/[\w./-]+/g;

/**
 * Collects the repository paths a body names inside its `## Scope` section, in the order they
 * appear and without repeats. A body with no `## Scope` section yields none.
 */
export function collectScopePaths(body: string): Array<string> {
  const scope = findScopeSection(body);

  if (scope === null) {
    return [];
  }

  const matches = scope.match(PATH_PATTERN) ?? [];

  return [...new Set(matches.map((match) => match.replace(/\.+$/, '')))];
}

function findScopeSection(body: string): string | null {
  const lines = body.split('\n');
  const headingPattern = buildHeadingPattern('Scope');
  const start = lines.findIndex((line) => headingPattern.test(line));

  if (start === -1) {
    return null;
  }

  let end = start + 1;

  while (end < lines.length && !/^##\s/.test(lines[end] ?? '')) {
    end += 1;
  }

  return lines.slice(start + 1, end).join('\n');
}
