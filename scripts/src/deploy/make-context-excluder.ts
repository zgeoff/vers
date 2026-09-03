import type { IgnorePattern } from './types';

export function makeContextExcluder(
  patterns: ReadonlyArray<IgnorePattern>,
): (path: string) => boolean {
  const compiled = patterns.map((pattern) => ({
    glob: new Bun.Glob(pattern.glob),
    negated: pattern.negated,
  }));

  return (path) => {
    const candidates = collectPathAndParents(path);
    let excluded = false;

    // docker semantics: a pattern that matches the path or any parent directory applies, and the
    // last applicable pattern decides
    for (const pattern of compiled) {
      if (candidates.some((candidate) => pattern.glob.match(candidate))) {
        excluded = !pattern.negated;
      }
    }

    return excluded;
  };
}

function collectPathAndParents(path: string): ReadonlyArray<string> {
  const segments = path.split('/');

  return segments.map((_, index) => segments.slice(0, index + 1).join('/'));
}
