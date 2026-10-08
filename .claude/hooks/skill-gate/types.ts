export interface SkillGate {
  readonly match: string;
  readonly skills: readonly string[];
}

export interface SkillGateRules {
  readonly ignore: readonly string[];
  readonly gates: readonly SkillGate[];
}

export type SkillGateRulesResult =
  | { readonly ok: true; readonly rules: SkillGateRules }
  | { readonly ok: false; readonly error: string };

export interface UnknownSkill {
  readonly match: string;
  readonly skill: string;
}

export interface SkillGateInput {
  readonly rules: SkillGateRules;
  readonly relativePath: string;
  readonly loadedSkills: readonly string[];
  readonly availableSkills: readonly string[];
}

export interface SkillGatePlan {
  readonly missing: readonly string[];
  readonly unknown: readonly UnknownSkill[];
}

export interface SkillGateHookOutput {
  readonly systemMessage?: string;
  readonly hookSpecificOutput: {
    readonly hookEventName: 'PreToolUse';
    readonly permissionDecision?: 'deny';
    readonly permissionDecisionReason?: string;
    readonly additionalContext?: string;
  };
}
