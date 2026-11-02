import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStubCommand } from '../test-utils/create-stub-command';
import { runInfraStack } from './run-infra-stack';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'infra-stack-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  return { directory };
}

test("it runs the pulumi stack script under op with the infra directory's env file and its arguments", async () => {
  const ctx = await setupTest();

  await createStubCommand('op', String.raw`printf '%s|%s\n' "$PWD" "$*"`);

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

  await createStubCommand('op', "echo '{\"steps\": []}'\necho 'warning: slow provider' >&2");

  const result = await runInfraStack({ args: ['preview', '--json'], infraPath: ctx.directory });

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: '{"steps": []}\n',
    stderr: 'warning: slow provider\n',
  });
});

test("it returns op's exit code when the command fails", async () => {
  const ctx = await setupTest();

  await createStubCommand('op', "echo 'error: 1 change found' >&2\nexit 255");

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
