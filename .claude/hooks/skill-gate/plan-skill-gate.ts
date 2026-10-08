import type { SkillGateInput, SkillGatePlan, UnknownSkill } from './types.ts';

// Plans the gate for one edit: the skills the path needs that the session has not loaded, in gate
// order without repeats, and each rule that names a skill the repo does not have. Such a skill never
// counts as missing, since no session could load it.
export function planSkillGate(input: SkillGateInput): SkillGatePlan {
  const unknown: UnknownSkill[] = input.rules.gates.flatMap((gate) =>
    gate.skills
      .filter((skill) => !input.availableSkills.includes(skill))
      .map((skill) => ({ match: gate.match, skill })),
  );

  if (input.rules.ignore.some((segment) => input.relativePath.includes(segment))) {
    return { missing: [], unknown };
  }

  const needed = input.rules.gates
    .filter((gate) => isGlobMatch(gate.match, input.relativePath))
    .flatMap((gate) => gate.skills);

  const missing = needed.filter(
    (skill) => input.availableSkills.includes(skill) && !input.loadedSkills.includes(skill),
  );

  return { missing: [...new Set(missing)], unknown };
}

function isGlobMatch(pattern: string, relativePath: string): boolean {
  const glob = new Bun.Glob(pattern);

  return glob.match(relativePath);
}
