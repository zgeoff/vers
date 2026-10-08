import path from 'node:path';
import { buildSkillGateOutput } from './build-skill-gate-output.ts';
import { collectLoadedSkills } from './collect-loaded-skills.ts';
import { parseSkillGateRules } from './parse-skill-gate-rules.ts';
import { planSkillGate } from './plan-skill-gate.ts';

// A PreToolUse hook for Edit, Write and MultiEdit that repo-sync delivers from zgeoff/tools. The
// repo's own .claude/skill-gate.json holds the rules; a repo without that file has no gate.
const payload: unknown = await Bun.stdin.json().catch(() => null);

const input = parseEditInput(payload);

if (input === null) {
  process.exit(0);
}

const projectDir = process.env['CLAUDE_PROJECT_DIR'] ?? input.cwd;
const rulesFile = Bun.file(path.join(projectDir, '.claude', 'skill-gate.json'));

const hasRules = await rulesFile.exists();

const filePath = path.resolve(input.cwd, input.filePath);
const relativePath = path.relative(projectDir, filePath).split(path.sep).join('/');

if (!hasRules || isOutsideProject(relativePath)) {
  process.exit(0);
}

const rulesText = await rulesFile.text();

const parsed = parseSkillGateRules(rulesText);

if (!parsed.ok) {
  printOutput(buildSkillGateOutput(filePath, { missing: [], unknown: [] }, parsed.error));

  process.exit(0);
}

const availableSkills = await collectAvailableSkills(path.join(projectDir, '.claude', 'skills'));
const transcript = await readTranscript(input.transcriptPath);

const loadedSkills = collectLoadedSkills(transcript);
const plan = planSkillGate({ rules: parsed.rules, relativePath, loadedSkills, availableSkills });

printOutput(buildSkillGateOutput(filePath, plan));

function parseEditInput(
  value: unknown,
): { cwd: string; filePath: string; transcriptPath: string } | null {
  if (!isRecord(value) || !isRecord(value['tool_input'])) {
    return null;
  }

  const cwd = value['cwd'];
  const transcriptPath = value['transcript_path'];
  const editPath = value['tool_input']['file_path'];

  if (
    typeof cwd !== 'string' ||
    typeof transcriptPath !== 'string' ||
    typeof editPath !== 'string'
  ) {
    return null;
  }

  return { cwd, filePath: editPath, transcriptPath };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOutsideProject(fromProject: string): boolean {
  return fromProject === '..' || fromProject.startsWith('../') || path.isAbsolute(fromProject);
}

async function collectAvailableSkills(skillsDir: string): Promise<readonly string[]> {
  const skills: string[] = [];

  const scan = new Bun.Glob('*/SKILL.md').scan({ cwd: skillsDir, followSymlinks: true });

  try {
    for await (const match of scan) {
      skills.push(path.dirname(match));
    }
  } catch {
    // A repo without .claude/skills has no skills, so each rule reports its skills as unknown.
  }

  return skills;
}

async function readTranscript(transcriptPath: string): Promise<string> {
  const transcriptFile = Bun.file(transcriptPath);

  const exists = await transcriptFile.exists();

  return exists ? transcriptFile.text() : '';
}

function printOutput(output: object | null): void {
  if (output !== null) {
    console.log(JSON.stringify(output));
  }
}
