import type { SkillGateRules } from './types.ts';

// Collects the skills that every gate matching a path names, in gate order and with repeats. A
// path that holds an ignore segment matches no gate.
export function collectGateSkills(rules: SkillGateRules, relativePath: string): readonly string[] {
  if (rules.ignore.some((segment) => relativePath.includes(segment))) {
    return [];
  }

  return rules.gates
    .filter((gate) => isGlobMatch(gate.match, relativePath))
    .flatMap((gate) => gate.skills);
}

function isGlobMatch(pattern: string, relativePath: string): boolean {
  const glob = new Bun.Glob(pattern);

  return glob.match(relativePath);
}
