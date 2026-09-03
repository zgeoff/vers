import path from 'node:path';
import type { IgnorePattern } from './types';

export function parseDockerignore(text: string): ReadonlyArray<IgnorePattern> {
  const patterns: Array<IgnorePattern> = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();

    if (line === '' || line.startsWith('#')) {
      continue;
    }

    const negated = line.startsWith('!');
    const body = negated ? line.slice(1) : line;
    const glob = normalizePattern(body);

    if (glob === '' || glob === '.') {
      continue;
    }

    patterns.push({ glob, negated });
  }

  return patterns;
}

// docker runs each pattern through filepath.Clean and anchors it at the context root, so `/dist`,
// `./dist`, `dist/`, and `x/../dist` all name the same root-level entry as `dist`
function normalizePattern(pattern: string): string {
  const cleaned = path.posix.normalize(pattern.trim());

  return cleaned.replace(/^\/+/, '').replace(/\/+$/, '');
}
