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

export interface LoadedSkills {
  readonly skills: readonly string[];
  readonly compacted: boolean;
}

export interface SkillGateInput {
  readonly rules: SkillGateRules;
  readonly relativePath: string;
  readonly loadedSkills: readonly string[];
  readonly availableSkills: readonly string[];
}

// A path a Bash command writes inside the project: absolute, and relative to the project root.
export interface ProjectPath {
  readonly path: string;
  readonly relativePath: string;
}

export interface BashSkillGateInput {
  readonly rules: SkillGateRules;
  readonly paths: readonly ProjectPath[];
  readonly loadedSkills: readonly string[];
  readonly availableSkills: readonly string[];
}

export interface BashSkillGatePlan {
  readonly gatedPaths: readonly string[];
  readonly missing: readonly string[];
}

export interface SkillGatePlan {
  readonly missing: readonly string[];
  readonly unknown: readonly UnknownSkill[];
}

export interface ShellWord {
  readonly text: string;
  readonly literal: boolean;
}

export interface ShellRedirect {
  readonly operator: string;
  readonly target: ShellWord;
}

// `enters` counts the subshells that open just before the command, and `leaves` the ones that
// close just after it.
export interface ShellCommand {
  readonly words: readonly ShellWord[];
  readonly redirects: readonly ShellRedirect[];
  readonly stdin: string | null;
  readonly enters: number;
  readonly leaves: number;
}

// A path a Bash command writes, relative to the command's working directory unless absolute. With
// a `fileName`, as for `cp a.ts dest`, the write lands at `path/fileName` when `path` is a
// directory, and at `path` otherwise.
export interface WrittenPath {
  readonly path: string;
  readonly fileName?: string;
}

export interface SkillGateOutputContext {
  readonly compacted?: boolean;
  readonly rulesError?: string;
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
