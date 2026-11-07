import type { SpawnSyncReturns } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { parseArgs } from 'node:util';

// A harness runs the call when a PreToolUse hook exits with any status but 2, so a static import
// that fails would let the call through. This file therefore imports only Node builtins.
const REFUSAL =
  'To work here, run exactly `bun install` or `bun install --frozen-lockfile` as its own Bash command, with no cd, pipe, redirect or other flag.';

const AFTER_INSTALL_OPTION = 'after-install';
const GUARD_SUFFIX = '.guard';

const READ_ONLY_PROGRAMS = new Set(['cat', 'ls', 'pwd']);

const PLAIN_WORDS = /^[\w./@:=+,-]+(?: [\w./@:=+,-]+)*$/u;
const ROOT = path.resolve(import.meta.dirname, '../..');

type LockState = 'absent' | 'held' | 'stale';

type InstallStep = 'retry-guard' | 'wait-for-guard' | 'stop' | 'wait-for-install' | 'install';

// The guard can vanish between a failed link and the read, so an absent guard means another try.
const INSTALL_STEPS = {
  guard: { absent: 'retry-guard', held: 'wait-for-guard', stale: 'stop' },
  install: { absent: 'install', held: 'wait-for-install', stale: 'install' },
} as const satisfies Readonly<Record<string, Readonly<Record<LockState, InstallStep>>>>;

interface Claim {
  readonly lock: keyof typeof INSTALL_STEPS;
  readonly state: LockState;
}

export function pickInstallStep(claim: Claim): InstallStep {
  return INSTALL_STEPS[claim.lock][claim.state];
}

type InstallResult = Pick<SpawnSyncReturns<Buffer>, 'error' | 'status' | 'signal'>;

// spawnSync reports a launch failure in `error` and a signal as a null status, and throws neither.
export function findInstallFailure(result: InstallResult): string | null {
  if (result.error !== undefined) {
    return String(result.error);
  }

  return result.status === null ? `bun install stopped on ${String(result.signal)}` : null;
}

type HookArgs =
  | {
      readonly kind: 'args';
      readonly harness: 'claude-code' | 'codex';
      readonly afterInstall: boolean;
    }
  | { readonly kind: 'error'; readonly message: string };

export function parseHookArgs(args: readonly string[]): HookArgs {
  try {
    const values = parseArgs({
      args: [...args],
      options: { harness: { type: 'string' }, [AFTER_INSTALL_OPTION]: { type: 'boolean' } },
    }).values;

    const harness = values.harness ?? 'claude-code';

    if (harness === 'claude-code' || harness === 'codex') {
      return { kind: 'args', harness, afterInstall: values[AFTER_INSTALL_OPTION] ?? false };
    }

    return {
      kind: 'error',
      message: `The agent hook does not know the harness ${harness}. Use codex or claude-code.`,
    };
  } catch (error) {
    return { kind: 'error', message: `The agent hook cannot read its arguments: ${String(error)}` };
  }
}

type AgentHooksImport<Module> =
  | { readonly kind: 'loaded'; readonly agentHooks: Module }
  | { readonly kind: 'failed'; readonly error: unknown };

type RecoveryStep<Module> =
  | { readonly kind: 'run-hook'; readonly agentHooks: Module }
  | { readonly kind: 'install-and-retry' }
  | { readonly kind: 'refuse'; readonly error: unknown };

export function pickRecoveryStep<Module>(
  agentHooksImport: AgentHooksImport<Module>,
  afterInstall: boolean,
): RecoveryStep<Module> {
  if (agentHooksImport.kind === 'loaded') {
    return { kind: 'run-hook', agentHooks: agentHooksImport.agentHooks };
  }

  return afterInstall
    ? { kind: 'refuse', error: agentHooksImport.error }
    : { kind: 'install-and-retry' };
}

export interface LockDependencies {
  readonly createDirectory: (directoryPath: string) => void;
  readonly readFile: (filePath: string) => string;
  readonly writeFile: (filePath: string, text: string) => void;
  readonly link: (existingPath: string, newPath: string) => void;
  readonly remove: (filePath: string) => void;
  readonly signalProcess: (pid: number) => void;
  readonly sleep: (durationMs: number) => Promise<void>;
}

// The entry point below runs at load, before any constant under it exists.
export const NODE_LOCK_DEPENDENCIES: LockDependencies = {
  createDirectory: (directoryPath) => {
    mkdirSync(directoryPath, { recursive: true });
  },
  readFile: (filePath) => readFileSync(filePath, 'utf8'),
  writeFile: writeFileSync,
  link: linkSync,
  remove: (filePath) => {
    rmSync(filePath, { force: true });
  },
  signalProcess: (pid) => {
    process.kill(pid, 0);
  },
  sleep: setTimeout,
};

if (import.meta.main) {
  await runHook(process.argv.slice(2));
}

async function runHook(argv: readonly string[]): Promise<never> {
  const args = parseHookArgs(argv);

  if (args.kind === 'error') {
    console.error(args.message);

    return process.exit(2);
  }

  const agentHooksImport = await import('@zgeoff/agent-hooks').then(
    (agentHooks) => ({ kind: 'loaded', agentHooks }) as const,
    (error: unknown) => ({ kind: 'failed', error }) as const,
  );

  const step = pickRecoveryStep(agentHooksImport, args.afterInstall);

  if (step.kind === 'run-hook') {
    return step.agentHooks.runAgentHook({ harness: args.harness });
  }

  if (step.kind === 'install-and-retry') {
    return runRetryAfterInstall(argv);
  }

  console.error(`The agent hook could not load @zgeoff/agent-hooks: ${String(step.error)}`);

  return refuseUnlessReadOnly(readPayloadText());
}

async function runRetryAfterInstall(argv: readonly string[]): Promise<never> {
  const installFailure = await runInstallOnce(
    path.join(ROOT, 'node_modules', '.agent-hooks-install.lock'),
    NODE_LOCK_DEPENDENCIES,
  ).catch(String);

  if (installFailure !== null) {
    console.error(`The agent hook could not run bun install: ${installFailure}`);
  }

  // Bun can keep a failed package lookup for the life of the process, so the retry is a new
  // process, which reads the hook payload from the same stdin. A `--` in the arguments ends the
  // options, so the retry flag goes before them.
  const retry = spawnSync(
    process.execPath,
    ['--no-install', import.meta.filename, `--${AFTER_INSTALL_OPTION}`, ...argv],
    { stdio: 'inherit' },
  );

  if (retry.error !== undefined) {
    console.error(`The agent hook could not start its retry: ${String(retry.error)}`);
  }

  return process.exit(retry.status ?? 2);
}

async function runInstallOnce(
  lockPath: string,
  dependencies: LockDependencies,
): Promise<string | null> {
  dependencies.createDirectory(path.dirname(lockPath));

  const step = await claimInstallLock(lockPath, dependencies);

  if (step === 'stop') {
    console.error(
      `A stopped agent hook left ${lockPath}${GUARD_SUFFIX} behind, so this one skips the install. Remove that file.`,
    );

    return null;
  }

  if (step === 'wait-for-install') {
    console.error('Another agent hook runs bun install here, so this one waits for it.');

    while (readLockState(lockPath, dependencies) === 'held') {
      await dependencies.sleep(100);
    }

    return null;
  }

  try {
    return findInstallFailure(
      spawnSync('bun', ['install', '--frozen-lockfile'], { cwd: ROOT, stdio: ['ignore', 2, 2] }),
    );
  } finally {
    dependencies.remove(lockPath);
  }
}

// Two hooks can both find the install lock stale, so every change to it happens under a guard lock;
// without the guard, one hook could remove the lock that another hook has just taken.
export async function claimInstallLock(
  lockPath: string,
  dependencies: LockDependencies,
): Promise<'stop' | 'wait-for-install' | 'install'> {
  const guardPath = `${lockPath}${GUARD_SUFFIX}`;

  for (let attempt = 0; !tryLock(guardPath, dependencies); attempt += 1) {
    const step = pickInstallStep({ lock: 'guard', state: readLockState(guardPath, dependencies) });

    if (step === 'stop') {
      return step;
    }

    if (step === 'wait-for-guard') {
      if (attempt === 0) {
        console.error(
          'Another agent hook claims the install lock here, so this one waits its turn.',
        );
      }

      await dependencies.sleep(10);
    }
  }

  try {
    const step = pickInstallStep({ lock: 'install', state: readLockState(lockPath, dependencies) });

    if (step === 'wait-for-install') {
      return step;
    }

    dependencies.remove(lockPath);

    return tryLock(lockPath, dependencies) ? 'install' : 'wait-for-install';
  } finally {
    dependencies.remove(guardPath);
  }
}

// A hard link fails when the lock exists and makes the lock appear with its process id already in
// it, so a hook never reads a lock that is still empty. Any other failure repeats on every try, so
// it ends the install instead of a retry.
function tryLock(lockPath: string, dependencies: LockDependencies): boolean {
  const draftPath = `${lockPath}.${process.pid}`;

  try {
    dependencies.writeFile(draftPath, String(process.pid));
    dependencies.link(draftPath, lockPath);

    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      return false;
    }

    throw error;
  } finally {
    dependencies.remove(draftPath);
  }
}

// A hook that the harness killed leaves its lock behind, so a lock counts as held only while the
// process it names runs.
export function readLockState(lockPath: string, dependencies: LockDependencies): LockState {
  const text = readLockText(lockPath, dependencies);

  if (text === null) {
    return 'absent';
  }

  const pid = Number(text);

  if (!Number.isSafeInteger(pid) || pid <= 0) {
    return 'stale';
  }

  try {
    dependencies.signalProcess(pid);

    return 'held';
  } catch (error) {
    return error instanceof Error && 'code' in error && error.code === 'EPERM' ? 'held' : 'stale';
  }
}

function readLockText(lockPath: string, dependencies: LockDependencies): string | null {
  try {
    return dependencies.readFile(lockPath);
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

  const [program = '', ...rest] = command.split(' ');

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
