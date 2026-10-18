import { statSync } from 'node:fs';
import path from 'node:path';
import { buildBashSkillGateOutput } from './build-bash-skill-gate-output.ts';
import { buildSkillGateOutput } from './build-skill-gate-output.ts';
import { collectLoadedSkills } from './collect-loaded-skills.ts';
import { collectWrittenPaths } from './collect-written-paths.ts';
import { parseSkillGateRules } from './parse-skill-gate-rules.ts';
import { planBashSkillGate } from './plan-bash-skill-gate.ts';
import { planSkillGate } from './plan-skill-gate.ts';
import type { WrittenPath } from './types.ts';

// A PreToolUse hook for Edit, Write, MultiEdit and Bash that repo-sync delivers from zgeoff/tools.
// The repo's own .claude/skill-gate.json holds the rules; a repo without that file has no gate. A
// subagent's loads come from its own transcript, never the main session's.
const payload: unknown = await Bun.stdin.json().catch(() => null);

const input = parseHookInput(payload);

if (input === null) {
  process.exit(0);
}

const projectDir = process.env['CLAUDE_PROJECT_DIR'] ?? input.cwd;
const rulesFile = Bun.file(path.join(projectDir, '.claude', 'skill-gate.json'));

const hasRules = await rulesFile.exists();

if (hasRules && input.command !== null) {
  await checkBashCommand(input, input.command);
}

if (input.filePath === null) {
  process.exit(0);
}

const filePath = path.resolve(input.cwd, input.filePath);
const relativePath = toProjectPath(filePath);

if (!hasRules || isOutsideProject(relativePath)) {
  process.exit(0);
}

const rulesText = await rulesFile.text();

const parsed = parseSkillGateRules(rulesText);

if (!parsed.ok) {
  printOutput(
    buildSkillGateOutput(filePath, { missing: [], unknown: [] }, { rulesError: parsed.error }),
  );

  process.exit(0);
}

const availableSkills = await collectAvailableSkills(path.join(projectDir, '.claude', 'skills'));
const transcript = await readTranscript(resolveSessionTranscriptPath(input));

const loaded = collectLoadedSkills(transcript);

const plan = planSkillGate({
  rules: parsed.rules,
  relativePath,
  loadedSkills: loaded.skills,
  availableSkills,
});

printOutput(buildSkillGateOutput(filePath, plan, { compacted: loaded.compacted }));

// An Edit, Write or MultiEdit call carries `file_path`, and a Bash call carries `command`.
interface HookInput {
  readonly cwd: string;
  readonly filePath: string | null;
  readonly command: string | null;
  readonly transcriptPath: string;
  readonly agentID: unknown;
}

function parseHookInput(value: unknown): HookInput | null {
  if (!isRecord(value) || !isRecord(value['tool_input'])) {
    return null;
  }

  const cwd = value['cwd'];
  const transcriptPath = value['transcript_path'];
  const editPath = value['tool_input']['file_path'];
  const command = value['tool_input']['command'];

  if (typeof cwd !== 'string' || typeof transcriptPath !== 'string') {
    return null;
  }

  if (typeof editPath !== 'string' && typeof command !== 'string') {
    return null;
  }

  return {
    cwd,
    filePath: typeof editPath === 'string' ? editPath : null,
    command: typeof command === 'string' ? command : null,
    transcriptPath,
    agentID: value['agent_id'],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOutsideProject(fromProject: string): boolean {
  return fromProject === '..' || fromProject.startsWith('../') || path.isAbsolute(fromProject);
}

// Warns on a command that writes a gated path in the project and exits; any other command goes
// ahead in silence. A broken rules file lets every command through, since the next edit reports it.
async function checkBashCommand(hookInput: HookInput, command: string): Promise<void> {
  const written = collectWrittenPaths(command).map((entry) =>
    readWrittenPath(hookInput.cwd, entry),
  );

  const candidates = [...new Set(written)].filter(
    (entry) => !isOutsideProject(toProjectPath(entry)),
  );

  if (candidates.length === 0) {
    process.exit(0);
  }

  const text = await rulesFile.text();

  const parsedRules = parseSkillGateRules(text);

  if (!parsedRules.ok) {
    process.exit(0);
  }

  const skills = await collectAvailableSkills(path.join(projectDir, '.claude', 'skills'));
  const sessionTranscript = await readTranscript(resolveSessionTranscriptPath(hookInput));

  const sessionLoads = collectLoadedSkills(sessionTranscript);

  const bashPlan = planBashSkillGate({
    rules: parsedRules.rules,
    paths: candidates.map((entry) => ({ path: entry, relativePath: toProjectPath(entry) })),
    loadedSkills: sessionLoads.skills,
    availableSkills: skills,
  });

  printOutput(
    buildBashSkillGateOutput(bashPlan.gatedPaths, bashPlan.missing, {
      compacted: sessionLoads.compacted,
    }),
  );

  process.exit(0);
}

// A `cp` or `mv` onto an existing directory writes the source's file name inside it.
function readWrittenPath(cwd: string, written: WrittenPath): string {
  const absolute = path.resolve(cwd, written.path);

  if (written.fileName === undefined) {
    return absolute;
  }

  const isDirectory = statSync(absolute, { throwIfNoEntry: false })?.isDirectory() === true;

  return isDirectory ? path.join(absolute, written.fileName) : absolute;
}

function toProjectPath(absolute: string): string {
  return path.relative(projectDir, absolute).split(path.sep).join('/');
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

// A subagent's call carries the main session's transcript_path plus its own agent_id, and Claude
// Code keeps its transcript at <session>/subagents/agent-<agent_id>.jsonl. An agent_id that is not
// a plain name resolves to no transcript, so the edit is denied.
function resolveSessionTranscriptPath(edit: HookInput): string | null {
  if (edit.agentID === undefined) {
    return edit.transcriptPath;
  }

  if (typeof edit.agentID !== 'string' || !/^[\w-]+$/u.test(edit.agentID)) {
    return null;
  }

  const sessionDir = edit.transcriptPath.replace(/\.jsonl$/u, '');

  return path.join(sessionDir, 'subagents', `agent-${edit.agentID}.jsonl`);
}

async function readTranscript(transcriptPath: string | null): Promise<string> {
  if (transcriptPath === null) {
    return '';
  }

  const transcriptFile = Bun.file(transcriptPath);

  const exists = await transcriptFile.exists();

  return exists ? transcriptFile.text() : '';
}

function printOutput(output: object | null): void {
  if (output !== null) {
    console.log(JSON.stringify(output));
  }
}
