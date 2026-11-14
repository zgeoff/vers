import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'bun';
import { createStubCommands, readStubCommandCalls } from './create-stub-commands';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'stub-commands-'));

  onTestFinished(() => rm(directory, { recursive: true, force: true }));

  return { directory };
}

test('#createStubCommands answers a call from the answer keyed by its name and first argument', async () => {
  const ctx = await setupTest();
  const stubs = await createStubCommands(ctx.directory, ['docker']);

  const result = await $`docker port pg 5432/tcp`
    .env({
      ...process.env,
      PATH: `${stubs.binDirectory}:${process.env['PATH'] ?? ''}`,
      STUB_COMMAND_LOG: stubs.logPath,
      STUB_COMMAND_ANSWERS: JSON.stringify({
        'docker port': { stdout: '127.0.0.1:55432', exitCode: 3 },
      }),
    })
    .nothrow()
    .quiet();

  expect({ exitCode: result.exitCode, stdout: result.stdout.toString() }).toStrictEqual({
    exitCode: 3,
    stdout: '127.0.0.1:55432\n',
  });
});

test('#createStubCommands exits 0 with no output for a call with no answer', async () => {
  const ctx = await setupTest();
  const stubs = await createStubCommands(ctx.directory, ['bunx']);

  const result = await $`bunx turbo run build`
    .env({
      ...process.env,
      PATH: `${stubs.binDirectory}:${process.env['PATH'] ?? ''}`,
      STUB_COMMAND_LOG: stubs.logPath,
    })
    .nothrow()
    .quiet();

  expect({ exitCode: result.exitCode, stdout: result.stdout.toString() }).toStrictEqual({
    exitCode: 0,
    stdout: '',
  });
});

test('#readStubCommandCalls lists each call with its arguments', async () => {
  const ctx = await setupTest();
  const stubs = await createStubCommands(ctx.directory, ['docker']);

  await $`docker rm --force pg`
    .env({
      ...process.env,
      PATH: `${stubs.binDirectory}:${process.env['PATH'] ?? ''}`,
      STUB_COMMAND_LOG: stubs.logPath,
    })
    .quiet();

  const calls = await readStubCommandCalls(stubs.logPath);

  expect(calls).toStrictEqual([{ name: 'docker', args: ['rm', '--force', 'pg'] }]);
});
