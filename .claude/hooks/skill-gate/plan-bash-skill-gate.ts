import { collectGateSkills } from './collect-gate-skills.ts';
import { planSkillGate } from './plan-skill-gate.ts';
import type { BashSkillGateInput, BashSkillGatePlan } from './types.ts';

export function planBashSkillGate(input: BashSkillGateInput): BashSkillGatePlan {
  const gated = input.paths.filter(
    (entry) => collectGateSkills(input.rules, entry.relativePath).length > 0,
  );

  const missing = gated.flatMap(
    (entry) =>
      planSkillGate({
        rules: input.rules,
        relativePath: entry.relativePath,
        loadedSkills: input.loadedSkills,
        availableSkills: input.availableSkills,
      }).missing,
  );

  return { gatedPaths: gated.map((entry) => entry.path), missing: [...new Set(missing)] };
}
