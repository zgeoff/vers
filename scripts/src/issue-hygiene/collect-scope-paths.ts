import { buildHeadingPattern } from './build-heading-pattern';

/**
 * Matches a repository path: any token under a source root, or any token naming a source file by
 * its extension. The leading boundary keeps a root from matching inside a longer word.
 */
const PATH_PATTERN =
  /(?<![\w./-])(?:[\w./-]*[\w-]\.(?:tsx?|jsx?|css|json|ya?ml|sh|sql)\b|(?:apps|contracts|infra|libs|scripts|services)\/[\w./-]+)/g;

/**
 * Roots the rule leaves alone. A documentation or workflow path renames rarely enough that flagging
 * it costs more noise than it saves.
 */
const EXCLUDED_ROOTS = ['.github', 'docs'];

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

  const paths = matches
    .map((match) => match.replace(/\.+$/, ''))
    .filter((path) => !isExcluded(path));

  return [...new Set(paths)];
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

function isExcluded(path: string): boolean {
  return EXCLUDED_ROOTS.some((root) => path.startsWith(`${root}/`));
}
