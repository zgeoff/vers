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

// docker anchors every pattern at the context root, so `/dist`, `./dist`, and `dist/` all name the
// same root-level entry as `dist`
function normalizePattern(pattern: string): string {
  let glob = pattern.trim();

  while (glob.startsWith('./')) {
    glob = glob.slice(2);
  }

  return glob.replace(/^\/+/, '').replace(/\/+$/, '');
}
