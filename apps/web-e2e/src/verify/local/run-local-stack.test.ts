import { expect, onTestFinished, test } from 'bun:test';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStubCommands, readStubCommandCalls } from '../../test-utils/create-stub-commands';

// Each test runs the real runLocalStack in its own process, through run-stub-local-stack.ts, with
// stand-in `docker` and `bunx` on PATH. A process of its own lets a test send it SIGTERM and
// SIGKILL, as wringer's `down` does.

interface StackRun {
  readonly answers: Readonly<Record<string, object>>;
  readonly readyDeadlineMs: number;
  readonly stopGraceMs: number;
  readonly heldChildren: number;
}

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'run-local-stack-'));

  const pidDirectory = join(directory, 'pids');

  await mkdir(pidDirectory);

  // a stand-in child that outlives a killed stack still dies with the test
  onTestFinished(async () => {
    for (const pid of await readdir(pidDirectory)) {
      try {
        process.kill(Number(pid), 'SIGKILL');
      } catch {
        // already gone
      }
    }

    await rm(directory, { recursive: true, force: true });
  });

  const stubs = await createStubCommands(directory, ['docker', 'bunx']);

  return {
    startStack: (run: StackRun) => {
      const stack = Bun.spawn(
        ['bun', join(import.meta.dir, '..', '..', 'test-utils', 'run-stub-local-stack.ts')],
        {
          env: {
            ...process.env,
            PATH: `${stubs.binDirectory}:${process.env['PATH'] ?? ''}`,
            STUB_COMMAND_LOG: stubs.logPath,
            STUB_COMMAND_ANSWERS: JSON.stringify(run.answers),
            STUB_PID_DIRECTORY: pidDirectory,
            STUB_STACK_PARTS: JSON.stringify({
              readyDeadlineMs: run.readyDeadlineMs,
              stopGraceMs: run.stopGraceMs,
              heldChildren: run.heldChildren,
            }),
          },
          stdout: 'pipe',
          stderr: 'ignore',
        },
      );

      onTestFinished(() => {
        stack.kill('SIGKILL');
      });

      return stack;
    },
    readDockerCalls: async () => {
      const calls = await readStubCommandCalls(stubs.logPath);

      return calls.filter((call) => call.name === 'docker').map((call) => call.args[0]);
    },

    // signal 0 checks that a process exists without touching it
    countLiveChildren: async () => {
      const pids = await readdir(pidDirectory);

      return pids.filter((pid) => {
        try {
          return process.kill(Number(pid), 0);
        } catch {
          return false;
        }
      }).length;
    },
  };
}

test('it exits 1 and removes the container when the web build fails before the container starts', async () => {
  const ctx = await setupTest();

  const stack = ctx.startStack({
    answers: {
      'docker run': { stdout: 'container-id', delayMs: 500 },
      'docker port': { stdout: '127.0.0.1:55432' },
      'docker exec': { exitCode: 0 },
      bunx: { exitCode: 1 },
    },
    readyDeadlineMs: 60_000,
    stopGraceMs: 3000,
    heldChildren: 0,
  });

  const exitCode = await stack.exited;
  const docker = await ctx.readDockerCalls();

  expect({ exitCode, docker }).toStrictEqual({ exitCode: 1, docker: ['run', 'port', 'rm'] });
});

test('it exits 1 and removes the container at once when the web build fails while Postgres is not ready', async () => {
  const ctx = await setupTest();

  const startedAt = performance.now();

  const stack = ctx.startStack({
    answers: {
      'docker run': { stdout: 'container-id' },
      'docker port': { stdout: '127.0.0.1:55432' },
      'docker exec': { exitCode: 1 },
      bunx: { exitCode: 1, delayMs: 300 },
    },
    readyDeadlineMs: 60_000,
    stopGraceMs: 3000,
    heldChildren: 0,
  });

  const exitCode = await stack.exited;

  const elapsedMs = performance.now() - startedAt;

  const docker = await ctx.readDockerCalls();

  expect({ exitCode, exitedWithin3s: elapsedMs < 3000, last: docker.at(-1) }).toStrictEqual({
    exitCode: 1,
    exitedWithin3s: true,
    last: 'rm',
  });
});

test('it exits 1 and removes the container when Postgres is not ready by the deadline', async () => {
  const ctx = await setupTest();

  const stack = ctx.startStack({
    answers: {
      'docker run': { stdout: 'container-id' },
      'docker port': { stdout: '127.0.0.1:55432' },
      'docker exec': { exitCode: 1 },
    },
    readyDeadlineMs: 1000,
    stopGraceMs: 3000,
    heldChildren: 0,
  });

  const exitCode = await stack.exited;
  const docker = await ctx.readDockerCalls();

  expect({ exitCode, last: docker.at(-1) }).toStrictEqual({ exitCode: 1, last: 'rm' });
});

test('it exits 1 and removes the container when a readiness check hangs past the deadline', async () => {
  const ctx = await setupTest();

  const stack = ctx.startStack({
    answers: {
      'docker run': { stdout: 'container-id' },
      'docker port': { stdout: '127.0.0.1:55432' },
      'docker exec': { exitCode: 0, delayMs: 3000 },
    },
    readyDeadlineMs: 500,
    stopGraceMs: 3000,
    heldChildren: 0,
  });

  const exitCode = await stack.exited;
  const docker = await ctx.readDockerCalls();

  expect({ exitCode, last: docker.at(-1) }).toStrictEqual({ exitCode: 1, last: 'rm' });
});

test('it removes the container and stops every child before the SIGKILL when children hold their stop', async () => {
  const ctx = await setupTest();

  const stack = ctx.startStack({
    answers: {
      'docker run': { stdout: 'container-id' },
      'docker port': { stdout: '127.0.0.1:55432' },
      'docker exec': { exitCode: 0 },
    },
    readyDeadlineMs: 60_000,
    stopGraceMs: 500,
    heldChildren: 4,
  });

  // the ready line
  await stack.stdout.getReader().read();

  // wringer's `down`: SIGTERM, then SIGKILL once its grace runs out, here 1.5 s
  stack.kill('SIGTERM');

  const forceKill = setTimeout(() => {
    stack.kill('SIGKILL');
  }, 1500);

  onTestFinished(() => {
    clearTimeout(forceKill);
  });

  const exitCode = await stack.exited;
  const docker = await ctx.readDockerCalls();
  const liveChildren = await ctx.countLiveChildren();

  expect({ exitCode, docker, liveChildren }).toStrictEqual({
    exitCode: 0,
    docker: ['run', 'port', 'exec', 'rm'],
    liveChildren: 0,
  });
});
