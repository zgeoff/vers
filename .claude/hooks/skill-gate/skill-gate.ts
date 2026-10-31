import { parseArgs } from 'node:util';

// Claude Code runs the call when a PreToolUse hook exits with any status but 2, so a static import
// that fails would let a gated edit through. This file therefore imports only Node builtins.
const harness = parseHarness(process.argv.slice(2));

const runGate = await import('@zgeoff/skill-gate').then(
  (gate) => gate.runSkillGate,
  (error: unknown) => () => reportLoadFailure(formatError(error)),
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

async function reportLoadFailure(loadError: string): Promise<never> {
  const payload: unknown = await Bun.stdin.json().catch(() => null);

  const call: Readonly<Record<string, unknown>> = isRecord(payload) ? payload : {};
  const event = call['hook_event_name'];

  if (typeof event === 'string' && event !== 'PreToolUse') {
    process.exit(0);
  }

  const toolName = call['tool_name'];

  const toolInput: Readonly<Record<string, unknown>> = isRecord(call['tool_input'])
    ? call['tool_input']
    : {};

  if (toolName === 'Bash' && isAllowedCommand(toolInput['command'])) {
    console.error(`The skill gate cannot load: ${loadError}`);
    process.exit(1);
  }

  const callName = typeof toolName === 'string' ? `this call to ${toolName}` : 'this call';

  console.error(
    `The skill gate cannot load, so it blocks ${callName}: ${loadError}. To work here, run bun install.`,
  );

  process.exit(2);
}

// The shell builds a path in more ways than a parser can follow, so without the gate a Bash call
// runs only as one of these read-only commands, or as the `bun install` that repairs the gate,
// written as one simple command in plain words.
function isAllowedCommand(command: unknown): boolean {
  if (typeof command !== 'string' || !/^[\w ./@=:,+-]+$/u.test(command)) {
    return false;
  }

  const words = command.trim().split(/ +/u);
  const [program, subcommand, ...rest] = words;

  if (program === 'ls' || program === 'cat' || program === 'pwd') {
    return true;
  }

  return (
    program === 'bun' &&
    subcommand === 'install' &&
    rest.every((word) => word === '--frozen-lockfile')
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
