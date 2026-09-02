import path from 'node:path';
import type { SkillGateVerdict } from './types';

interface SkillGate {
  readonly skill: string;
  readonly matches: (relativePath: string) => boolean;
}

/**
 * The skills an edit under a path needs in context, keyed by what the path is. A path can need
 * several: a test file needs both the code-style and the testing skill.
 */
const GATES: ReadonlyArray<SkillGate> = [
  { matches: (file) => /\.tsx?$/.test(file), skill: 'code-style' },
  { matches: (file) => /\.test\.tsx?$/.test(file), skill: 'testing' },
  { matches: (file) => file.endsWith('.md'), skill: 'docs-writing' },
  {
    matches: (file) => LIFECYCLE_ROOTS.some((root) => file.startsWith(root)),
    skill: 'game-lifecycle',
  },
];

// The packages whose lifecycle the game-lifecycle skill orients.
const LIFECYCLE_ROOTS = [
  'contracts/activity/',
  'contracts/replay/',
  'libs/game/idle-client/',
  'libs/game/idle-core/',
  'services/activity/',
  'services/replay/',
];

// Generated output and vendored trees carry no rules of their own.
const UNGATED_SEGMENTS = ['node_modules/', 'styled-system/', 'dist/', '.generated.'];

/**
 * Plans the gate's verdict for editing `filePath` from a session whose transcript shows
 * `loadedSkills` in context. A path outside `cwd`, a generated file, or a file kind no gate names
 * is allowed; otherwise every gated skill not yet loaded is reported, so one deny lists them all.
 */
export function planSkillGate(
  cwd: string,
  filePath: string,
  loadedSkills: ReadonlySet<string>,
): SkillGateVerdict {
  const relative = path.relative(cwd, filePath);

  if (relative.startsWith('..') || path.isAbsolute(relative) || isUngated(relative)) {
    return { kind: 'allow' };
  }

  const missing = GATES.filter(
    (gate) => gate.matches(relative) && !loadedSkills.has(gate.skill),
  ).map((gate) => gate.skill);

  return missing.length === 0 ? { kind: 'allow' } : { kind: 'deny', missing };
}

function isUngated(relative: string): boolean {
  return UNGATED_SEGMENTS.some((segment) => relative.includes(segment));
}
