import path from 'node:path';
import type { DocPathReference } from './types';

/**
 * Matches a repository path a doc names in prose or code: a token under a known root, or a
 * relative markdown link target. A bare file name with no directory is not collected, because
 * nothing says which directory it lives in.
 */
const ROOTED_PATH_PATTERN =
  /(?<![\w./-])(?:apps|contracts|docs|infra|libs|scripts|services|\.github|\.claude)\/[\w./*<>{}$-]*[\w*>}$-]/g;

const LINK_PATTERN = /\]\((?<target>\.{1,2}\/[^)#\s]+)(?:#[^)]*)?\)/g;

// Placeholders, globs, and env files name no single committed file.
const UNCHECKABLE_PATTERN = /[<>*{}$]|(?:^|\/)\.env/;

/**
 * Collects the repository paths `markdown` names, each with the 1-based line that names it and
 * relative to the repository root. `docPath` is the document's own repo-relative path, which
 * resolves its relative links. A path named on several lines is reported once per line.
 */
export function collectDocPaths(markdown: string, docPath: string): Array<DocPathReference> {
  const docDir = path.posix.dirname(docPath);
  const references: Array<DocPathReference> = [];

  markdown.split('\n').forEach((text, index) => {
    const line = index + 1;

    const found = new Set<string>();

    for (const match of text.matchAll(LINK_PATTERN)) {
      const target = match.groups?.['target'];

      if (target !== undefined) {
        found.add(path.posix.normalize(path.posix.join(docDir, target)));
      }
    }

    for (const match of text.matchAll(ROOTED_PATH_PATTERN)) {
      found.add(match[0]);
    }

    for (const candidate of found) {
      if (!UNCHECKABLE_PATTERN.test(candidate)) {
        references.push({ line, path: candidate });
      }
    }
  });

  return references;
}
