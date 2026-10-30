import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

// Claude Code runs the call when a PreToolUse hook exits with any status but 2, so a static import
// that fails would let a gated edit through. This file therefore imports only Node builtins.
const harness = parseHarness(process.argv.slice(2));

const runGate = await import('@zgeoff/skill-gate').then(
  (gate) => gate.runSkillGate,
  (error: unknown) => () => reportLoadFailure(formatError(error), harness),
);

await runGate(harness);

type Harness = 'claude-code' | 'codex';

// The hook command picks the harness: `--harness codex` for Codex, and none for Claude Code.
function parseHarness(args: readonly string[]): Harness {
  const value = parseHarnessOption(args);

  if (value instanceof Error) {
    console.error(`The skill gate cannot read its arguments: ${value.message}`);

    return process.exit(1);
  }

  if (value === undefined) {
    return 'claude-code';
  }

  if (value === 'codex' || value === 'claude-code') {
    return value;
  }

  console.error(`The skill gate does not know the harness ${value}. Use codex or claude-code.`);

  return process.exit(1);
}

// parseArgs throws on an option it does not declare and on --harness with no value.
function parseHarnessOption(args: readonly string[]): string | Error | undefined {
  try {
    return parseArgs({ args: [...args], options: { harness: { type: 'string' } }, strict: true })
      .values.harness;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

// Bun rejects a failed import with a ResolveMessage, which is not an Error.
function formatError(error: unknown): string {
  if (isRecord(error) && typeof error['message'] === 'string') {
    return error['message'];
  }

  return String(error);
}

async function reportLoadFailure(loadError: string, failedHarness: Harness): Promise<never> {
  const payload: unknown = await Bun.stdin.json().catch(() => null);
  const projectDir = await readProjectDir(payload);

  const edit = parseEdit(payload, projectDir, failedHarness);

  const gatedPaths = await readGatedEdits(edit);

  if (gatedPaths.length > 0) {
    console.error(
      `The skill gate cannot load, so it blocks this edit to ${gatedPaths.join(', ')}: ${loadError}. Run \`bun install\` at the repo root, then retry the edit.`,
    );

    process.exit(2);
  }

  const toolCall = parseToolCall(payload, projectDir);

  const isGatedTool = await probeGatedToolCall(toolCall, readTextFile);

  if (toolCall !== null && isGatedTool) {
    console.error(
      `The skill gate cannot load, so it blocks this call to ${toolCall.toolName}: ${loadError}. Run \`bun install\` at the repo root, then retry the call.`,
    );

    process.exit(2);
  }

  console.error(`The skill gate cannot load: ${loadError}`);
  process.exit(1);
}

interface Edit {
  readonly projectDir: string;
  readonly filePaths: readonly string[];
}

// Claude Code's Edit, Write and MultiEdit calls carry `file_path`. Codex's apply_patch call carries
// a patch whose header lines name each path it changes.
function parseEdit(payload: unknown, projectDir: string | undefined, edited: Harness): Edit | null {
  if (!isRecord(payload) || !isRecord(payload['tool_input'])) {
    return null;
  }

  const cwd = payload['cwd'];

  if (typeof cwd !== 'string') {
    return null;
  }

  const paths =
    edited === 'codex'
      ? parsePatchPaths(payload['tool_name'], payload['tool_input']['command'])
      : [payload['tool_input']['file_path']].filter((entry) => typeof entry === 'string');

  return {
    projectDir: projectDir ?? cwd,
    filePaths: paths.map((entry) => path.resolve(cwd, entry)),
  };
}

function parsePatchPaths(toolName: unknown, patch: unknown): readonly string[] {
  if (toolName !== 'apply_patch' || typeof patch !== 'string') {
    return [];
  }

  // The module-level code above awaits the gate before any const below it runs, so the pattern lives here.
  const header = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (?<path>.+)$/u;

  return patch
    .split('\n')
    .flatMap((line) => header.exec(line.replace(/\r$/u, ''))?.groups?.['path']?.trim() ?? []);
}

// The gated paths among those the edit changes. A rules file that cannot be read or parsed gates
// every path inside the project.
async function readGatedEdits(edit: Edit | null): Promise<readonly string[]> {
  if (edit === null) {
    return [];
  }

  const inside = edit.filePaths.filter((filePath) => {
    const relativePath = path.relative(edit.projectDir, filePath).split(path.sep).join('/');

    return !(
      relativePath === '..' ||
      relativePath.startsWith('../') ||
      path.isAbsolute(relativePath)
    );
  });

  if (inside.length === 0) {
    return [];
  }

  const rulesText = await readTextFile(
    path.join(edit.projectDir, '.claude', 'skill-gate.json'),
  ).catch((error: unknown) => {
    console.error(`The skill gate cannot read .claude/skill-gate.json: ${formatError(error)}`);

    return null;
  });

  if (rulesText === undefined) {
    return [];
  }

  return inside.filter(
    (filePath) =>
      rulesText === null ||
      isGatedPath(rulesText, path.relative(edit.projectDir, filePath).split(path.sep).join('/')),
  );
}

function isGatedPath(rulesText: string, relativePath: string): boolean {
  const rules = parseRules(rulesText);

  if (rules === null) {
    return true;
  }

  if (rules.ignore.some((segment) => relativePath.includes(segment))) {
    return false;
  }

  return rules.matches.some((match) => new Bun.Glob(match).match(relativePath));
}

interface Rules {
  readonly ignore: readonly string[];
  readonly matches: readonly string[];
}

function parseRules(text: string): Rules | null {
  const value = parseJSON(text);

  if (!isRecord(value)) {
    return null;
  }

  const ignore = value['ignore'] ?? [];
  const gates = value['gates'];

  if (!isStringArray(ignore) || !Array.isArray(gates)) {
    return null;
  }

  const matches = gates.map((entry: unknown) =>
    isRecord(entry) &&
    typeof entry['match'] === 'string' &&
    entry['match'] !== '' &&
    isStringArray(entry['skills']) &&
    entry['skills'].length > 0
      ? entry['match']
      : null,
  );

  if (matches.includes(null)) {
    return null;
  }

  return { ignore, matches: matches.filter((match) => match !== null) };
}

interface ToolCall {
  readonly projectDir: string;
  readonly toolName: string;
}

// CLAUDE_PROJECT_DIR is Claude Code's. Codex sets none, so the project is the git top level of the
// payload's working directory, or that directory itself outside a repo.
async function readProjectDir(payload: unknown): Promise<string | undefined> {
  const fromEnv = process.env['CLAUDE_PROJECT_DIR'];

  if (fromEnv !== undefined && fromEnv !== '') {
    return fromEnv;
  }

  const cwd = isRecord(payload) ? payload['cwd'] : undefined;

  if (typeof cwd !== 'string') {
    return undefined;
  }

  try {
    const child = Bun.spawn(['git', 'rev-parse', '--show-toplevel'], {
      cwd,
      stdout: 'pipe',
      stderr: 'ignore',
    });

    const [output, exitCode] = await Promise.all([new Response(child.stdout).text(), child.exited]);

    if (exitCode !== 0) {
      return undefined;
    }

    const topLevel = output.trim();

    return topLevel === '' ? undefined : topLevel;
  } catch {
    return undefined;
  }
}

function parseToolCall(payload: unknown, projectDir: string | undefined): ToolCall | null {
  if (!isRecord(payload)) {
    return null;
  }

  const cwd = payload['cwd'];
  const toolName = payload['tool_name'];

  if (typeof cwd !== 'string' || typeof toolName !== 'string') {
    return null;
  }

  return { projectDir: projectDir ?? cwd, toolName };
}

// The hook matcher names only gated tools beside edits and Bash, so any other call that reaches
// the hook counts as gated when the rules file cannot be read or parsed.
async function probeGatedToolCall(toolCall: ToolCall | null, readText: ReadText): Promise<boolean> {
  if (
    toolCall === null ||
    ['Edit', 'Write', 'MultiEdit', 'Bash', 'apply_patch'].includes(toolCall.toolName)
  ) {
    return false;
  }

  const rulesText = await readText(
    path.join(toolCall.projectDir, '.claude', 'skill-gate.json'),
  ).catch(() => null);

  if (rulesText === undefined) {
    return false;
  }

  const tools = rulesText === null ? null : parseGatedTools(rulesText);

  return tools === null || tools.includes(toolCall.toolName);
}

type ReadText = (filePath: string) => Promise<string | undefined>;

// Bun.file(...).exists() is false for a folder, so the hook stats the path instead.
async function readTextFile(filePath: string): Promise<string | undefined> {
  const isPresent = await probePath(filePath);

  return isPresent ? readFile(filePath, 'utf8') : undefined;
}

async function probePath(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);

    return true;
  } catch (error) {
    return !(isRecord(error) && (error['code'] === 'ENOENT' || error['code'] === 'ENOTDIR'));
  }
}

function parseGatedTools(text: string): readonly string[] | null {
  const value = parseJSON(text);

  if (!isRecord(value)) {
    return null;
  }

  const tools = value['tools'] ?? [];

  if (!Array.isArray(tools)) {
    return null;
  }

  const names = tools.map((entry: unknown) =>
    isRecord(entry) && typeof entry['tool'] === 'string' ? entry['tool'] : null,
  );

  return names.includes(null) ? null : names.filter((name) => name !== null);
}

function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item !== '');
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
