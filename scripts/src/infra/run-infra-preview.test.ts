import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStubCommand } from '../test-utils/create-stub-command';
import { runInfraPreview } from './run-infra-preview';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'infra-preview-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  return { directory };
}

test("it runs the pulumi preview script under op with the infra directory's env file", async () => {
  const ctx = await setupTest();

  await createStubCommand('op', String.raw`printf '%s|%s\n' "$PWD" "$*"`);

  const result = await runInfraPreview({
    infraPath: ctx.directory,
    outputPath: join(ctx.directory, 'preview.txt'),
  });

  expect(result.output).toBe(
    `${ctx.directory}|run --env-file=.env.example -- bun ${join(import.meta.dirname, '../bin/pulumi-preview.ts')}\n`,
  );
});

test("it keeps op's output and errors in the output file", async () => {
  const ctx = await setupTest();

  const outputPath = join(ctx.directory, 'preview.txt');

  await createStubCommand('op', "echo 'Previewing update (prod)'\necho 'warning: drift' >&2");
  await runInfraPreview({ infraPath: ctx.directory, outputPath });

  const output = await readFile(outputPath, 'utf8');

  expect(output).toBe('Previewing update (prod)\nwarning: drift\n');
});

test("it returns op's exit code when the preview fails", async () => {
  const ctx = await setupTest();

  await createStubCommand('op', "echo 'error: 1 change found'\nexit 255");

  const result = await runInfraPreview({
    infraPath: ctx.directory,
    outputPath: join(ctx.directory, 'preview.txt'),
  });

  expect(result).toStrictEqual({ exitCode: 255, output: 'error: 1 change found\n' });
});
