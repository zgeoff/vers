import { stat } from 'node:fs/promises';
import { Glob } from 'bun';
import { collectDocPaths } from '../docs/collect-doc-paths';

// Reports every repository path a committed doc names that does not exist, so a rename cannot leave
// a doc pointing at nothing. Exits 1 when any is missing.

const DOC_GLOBS = ['AGENTS.md', 'README.md', 'docs/**/*.md', '.claude/skills/*/SKILL.md'];
const missing: Array<string> = [];

for (const pattern of DOC_GLOBS) {
  for await (const docPath of new Glob(pattern).scan({ cwd: process.cwd(), dot: true })) {
    const markdown = await Bun.file(docPath).text();

    for (const reference of collectDocPaths(markdown, docPath)) {
      if (!(await Bun.file(reference.path).exists()) && !(await isDirectory(reference.path))) {
        missing.push(`${docPath}:${reference.line}: ${reference.path}`);
      }
    }
  }
}

if (missing.length > 0) {
  console.error(`doc-paths: ${missing.length} missing path(s)\n${missing.join('\n')}`);
  process.exit(1);
}

console.log('doc-paths: clean');

async function isDirectory(candidate: string): Promise<boolean> {
  try {
    const info = await stat(candidate);

    return info.isDirectory();
  } catch {
    return false;
  }
}
