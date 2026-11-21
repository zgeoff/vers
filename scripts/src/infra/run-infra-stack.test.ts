import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateEnv } from '@zgeoff/testing';
import { createStubBin } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { runInfraStack } from './run-infra-stack';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'infra-stack-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  return { directory };
}

test("it runs the pulumi stack script under op with the infra directory's env file and its arguments", async () => {
  const ctx = await setupTest();

  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'op', {
    script: `#!/bin/sh\n${String.raw`printf '%s|%s\n' "$PWD" "$*"`}`,
  });

  const result = await runInfraStack({
    args: ['preview', '--refresh', '--diff'],
    infraPath: ctx.directory,
  });

  expect(result.stdout).toBe(
    `${ctx.directory}|run --env-file=.env.example -- bun ${join(import.meta.dirname, '../bin/pulumi-stack.ts')} preview --refresh --diff\n`,
  );
});

test("it keeps op's output and errors apart", async () => {
  const ctx = await setupTest();

  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'op', {
    script: "#!/bin/sh\necho '{\"steps\": []}'\necho 'warning: slow provider' >&2",
  });

  const result = await runInfraStack({ args: ['preview', '--json'], infraPath: ctx.directory });

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: '{"steps": []}\n',
    stderr: 'warning: slow provider\n',
  });
});

test("it returns op's exit code when the command fails", async () => {
  const ctx = await setupTest();

  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'op', {
    script: "#!/bin/sh\necho 'error: 1 change found' >&2\nexit 255",
  });

  const result = await runInfraStack({
    args: ['preview', '--expect-no-changes'],
    infraPath: ctx.directory,
  });

  expect(result).toStrictEqual({
    exitCode: 255,
    stdout: '',
    stderr: 'error: 1 change found\n',
  });
});
