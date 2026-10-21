// The skill gate's entry point, which repo-sync delivers from zgeoff/tools. The gate lives in
// @zgeoff/skill-gate, which the repo installs at its root.
import path from 'node:path';

// Claude Code runs the call when a PreToolUse hook exits with any status but 2, so a static import
// that fails would let a gated edit through. This file therefore imports only Node builtins.
const runGate = await import('@zgeoff/skill-gate').then(
  (gate) => gate.runSkillGate,
  (error: unknown) => () => reportLoadFailure(formatError(error)),
);

await runGate();

// Bun rejects a failed import with a ResolveMessage, which is not an Error.
function formatError(error: unknown): string {
  if (isRecord(error) && typeof error['message'] === 'string') {
    return error['message'];
  }

  return String(error);
}

async function reportLoadFailure(loadError: string): Promise<never> {
  const payload: unknown = await Bun.stdin.json().catch(() => null);

  const edit = parseEdit(payload, process.env['CLAUDE_PROJECT_DIR']);

  const isGated = await probeGatedEdit(edit);

  if (edit !== null && isGated) {
    console.error(
      `The skill gate cannot load, so it blocks this edit to ${edit.filePath}: ${loadError}. Run \`bun install\` at the repo root, then retry the edit.`,
    );

    process.exit(2);
  }

  console.error(`The skill gate cannot load: ${loadError}`);
  process.exit(1);
}

interface Edit {
  readonly projectDir: string;
  readonly filePath: string;
}

// Only an Edit, Write or MultiEdit call carries `file_path`; the gate never blocks a Bash call.
function parseEdit(payload: unknown, projectDir: string | undefined): Edit | null {
  if (!isRecord(payload) || !isRecord(payload['tool_input'])) {
    return null;
  }

  const cwd = payload['cwd'];
  const filePath = payload['tool_input']['file_path'];

  if (typeof cwd !== 'string' || typeof filePath !== 'string') {
    return null;
  }

  return {
    projectDir: projectDir ?? cwd,
    filePath: path.resolve(cwd, filePath),
  };
}

async function probeGatedEdit(edit: Edit | null): Promise<boolean> {
  if (edit === null) {
    return false;
  }

  const relativePath = path.relative(edit.projectDir, edit.filePath).split(path.sep).join('/');

  if (relativePath === '..' || relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
    return false;
  }

  const rulesFile = Bun.file(path.join(edit.projectDir, '.claude', 'skill-gate.json'));

  const hasRules = await rulesFile.exists();

  if (!hasRules) {
    return false;
  }

  const rulesText = await rulesFile.text().catch((error: unknown) => {
    console.error(`The skill gate cannot read .claude/skill-gate.json: ${formatError(error)}`);

    return null;
  });

  return rulesText === null || isGatedPath(rulesText, relativePath);
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
