import { spawnSync } from 'node:child_process';
import { linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { parseArgs } from 'node:util';

// A harness runs the call when a PreToolUse hook exits with any status but 2, so a static import
// that fails would let the call through. This file therefore imports only Node builtins.
const REFUSAL =
  'To work here, run exactly `bun install` or `bun install --frozen-lockfile` as its own Bash command, with no cd, pipe, redirect or other flag.';

const AFTER_INSTALL = '--after-install';
const GUARD_SUFFIX = '.guard';

const READ_ONLY_PROGRAMS = new Set(['cat', 'ls', 'pwd']);

const PLAIN_WORDS = /^[\w./@:=+,-]+(?: [\w./@:=+,-]+)*$/u;
const ROOT = path.resolve(import.meta.dirname, '../..');

type LockState = 'absent' | 'held' | 'stale';

type ClaimStep = 'retry-guard' | 'wait-for-guard' | 'give-up' | 'wait-for-install' | 'take-lock';

// The guard can vanish between a failed link and the read, so an absent guard means another try.
const CLAIM_STEPS = {
  guard: { absent: 'retry-guard', held: 'wait-for-guard', stale: 'give-up' },
  install: { absent: 'take-lock', held: 'wait-for-install', stale: 'take-lock' },
} as const satisfies Readonly<Record<string, Readonly<Record<LockState, ClaimStep>>>>;

interface Claim {
  readonly lock: keyof typeof CLAIM_STEPS;
  readonly state: LockState;
}

export function pickClaimStep(claim: Claim): ClaimStep {
  return CLAIM_STEPS[claim.lock][claim.state];
}

if (import.meta.main) {
  await runHook(process.argv.slice(2));
}

async function runHook(args: readonly string[]): Promise<void> {
  const harness = parseHarness(args.filter((arg) => arg !== AFTER_INSTALL));

  const agentHooksImport = await import('@zgeoff/agent-hooks').then(
    (agentHooks) => ({ agentHooks, error: null }),
    (error: unknown) => ({ agentHooks: null, error }),
  );

  if (agentHooksImport.agentHooks !== null) {
    await agentHooksImport.agentHooks.runAgentHook({ harness });
  }

  if (!args.includes(AFTER_INSTALL)) {
    try {
      await runInstallOnce(path.join(ROOT, 'node_modules', '.agent-hooks-install.lock'));
    } catch (error) {
      console.error(`The agent hook could not run bun install: ${String(error)}`);
    }

    // Bun can keep a failed package lookup for the life of the process, so the retry is a new
    // process, which reads the hook payload from the same stdin.
    const retry = spawnSync(
      process.execPath,
      ['--no-install', import.meta.filename, ...args, AFTER_INSTALL],
      {
        stdio: 'inherit',
      },
    );

    process.exit(retry.status ?? 2);
  }

  console.error(
    `The agent hook could not load @zgeoff/agent-hooks: ${String(agentHooksImport.error)}`,
  );

  refuseUnlessReadOnly(readPayloadText());
}

function parseHarness(harnessArgs: readonly string[]): 'claude-code' | 'codex' {
  try {
    const value = parseArgs({ args: [...harnessArgs], options: { harness: { type: 'string' } } })
      .values.harness;

    if (value === undefined || value === 'claude-code' || value === 'codex') {
      return value ?? 'claude-code';
    }

    console.error(`The agent hook does not know the harness ${value}. Use codex or claude-code.`);
  } catch (error) {
    console.error(`The agent hook cannot read its arguments: ${String(error)}`);
  }

  return process.exit(2);
}

async function runInstallOnce(lockPath: string): Promise<void> {
  mkdirSync(path.dirname(lockPath), { recursive: true });

  const claim = await claimInstallLock(lockPath);

  if (claim === 'stuck') {
    console.error(
      `A stopped agent hook left ${lockPath}${GUARD_SUFFIX} behind, so this one skips the install. Remove that file.`,
    );

    return;
  }

  if (claim === 'waiter') {
    console.error('Another agent hook runs bun install here, so this one waits for it.');

    while (readLockState(lockPath) === 'held') {
      await setTimeout(100);
    }

    return;
  }

  try {
    spawnSync('bun', ['install', '--frozen-lockfile'], { cwd: ROOT, stdio: ['ignore', 2, 2] });
  } finally {
    rmSync(lockPath, { force: true });
  }
}

// Two hooks can both find the install lock stale, so every change to it happens under a guard lock;
// without the guard, one hook could remove the lock that another hook has just taken.
async function claimInstallLock(lockPath: string): Promise<'owner' | 'waiter' | 'stuck'> {
  const guardPath = `${lockPath}${GUARD_SUFFIX}`;

  for (let attempt = 0; !tryLock(guardPath); attempt += 1) {
    const step = pickClaimStep({ lock: 'guard', state: readLockState(guardPath) });

    if (step === 'give-up') {
      return 'stuck';
    }

    if (step === 'wait-for-guard') {
      if (attempt === 0) {
        console.error(
          'Another agent hook claims the install lock here, so this one waits its turn.',
        );
      }

      await setTimeout(10);
    }
  }

  try {
    if (pickClaimStep({ lock: 'install', state: readLockState(lockPath) }) === 'wait-for-install') {
      return 'waiter';
    }

    rmSync(lockPath, { force: true });

    return tryLock(lockPath) ? 'owner' : 'waiter';
  } finally {
    rmSync(guardPath, { force: true });
  }
}

// A hard link fails when the lock exists and makes the lock appear with its process id already in
// it, so a hook never reads a lock that is still empty. Any other failure repeats on every try, so
// it ends the install instead of a retry.
function tryLock(lockPath: string): boolean {
  const draftPath = `${lockPath}.${process.pid}`;

  try {
    writeFileSync(draftPath, String(process.pid));
    linkSync(draftPath, lockPath);

    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      return false;
    }

    throw error;
  } finally {
    rmSync(draftPath, { force: true });
  }
}

// A hook that the harness killed leaves its lock behind, so a lock counts as held only while the
// process it names runs.
function readLockState(lockPath: string): LockState {
  const text = readLockText(lockPath);

  if (text === null) {
    return 'absent';
  }

  const pid = Number(text);

  if (!Number.isSafeInteger(pid) || pid <= 0) {
    return 'stale';
  }

  try {
    process.kill(pid, 0);

    return 'held';
  } catch (error) {
    return error instanceof Error && 'code' in error && error.code === 'EPERM' ? 'held' : 'stale';
  }
}

function readLockText(lockPath: string): string | null {
  try {
    return readFileSync(lockPath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

function readPayloadText(): string {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

// An agent can still run bun install by hand, and read the tree, while the package cannot load.
function refuseUnlessReadOnly(payloadText: string): never {
  const payload: unknown = parseJSON(payloadText);
  const event = readField(payload, 'hook_event_name');

  if (event !== undefined && event !== 'PreToolUse') {
    process.exit(0);
  }

  const command = readField(readField(payload, 'tool_input'), 'command');

  if (
    readField(payload, 'tool_name') === 'Bash' &&
    typeof command === 'string' &&
    isReadOnlyCommand(command)
  ) {
    process.exit(0);
  }

  console.error(REFUSAL);

  return process.exit(2);
}

function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readField(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// A shell can build a path from a variable, a glob or a substitution, and runs a second command
// after a line break, so a command passes only as plain words between single spaces. Git is left
// out: its config can make even a `git diff` with external diffs off run an fsmonitor program.
function isReadOnlyCommand(command: string): boolean {
  if (!PLAIN_WORDS.test(command)) {
    return false;
  }

  const [program, ...rest] = command.split(' ');

  if (program === undefined) {
    return false;
  }

  if (READ_ONLY_PROGRAMS.has(program)) {
    return true;
  }

  const [subcommand, ...options] = rest;

  return (
    program === 'bun' &&
    subcommand === 'install' &&
    options.every((option) => option === '--frozen-lockfile')
  );
}
