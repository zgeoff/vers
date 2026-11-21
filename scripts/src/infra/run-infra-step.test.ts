import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateEnv } from '@zgeoff/testing';
import { createStubBin } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { runInfraStep } from './run-infra-step';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'infra-step-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  return { directory, summaryPath: join(directory, 'summary.md') };
}

test.each([
  ['drift', 'preview --refresh --diff --expect-no-changes'],
  ['drift-before', 'preview --refresh --diff --expect-no-changes'],
  ['drift-after', 'preview --refresh --diff --expect-no-changes'],
  ['change', 'preview --refresh --diff'],
  ['apply', 'up --refresh --yes --skip-preview --diff'],
])('it runs the %s step as pulumi %s', async (stepName, pulumiArgs) => {
  const ctx = await setupTest();

  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);
  createStubBin(stubDirectory, 'op', { script: '#!/bin/sh\nshift 5\necho "$*"' });

  const result = await runInfraStep({
    infraPath: ctx.directory,
    stepName,
    summaryPath: ctx.summaryPath,
  });

  expect(result).toStrictEqual({ exitCode: 0, output: `${pulumiArgs}\n` });
});

test("it adds the step's output and errors to the step summary under the step's heading", async () => {
  const ctx = await setupTest();

  await writeFile(ctx.summaryPath, '## Install\n');

  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'op', {
    script:
      "#!/bin/sh\necho '  ~ github:index/issueLabel:IssueLabel bug update'\necho 'error: 1 change found' >&2\nexit 255",
  });

  await runInfraStep({ infraPath: ctx.directory, stepName: 'drift', summaryPath: ctx.summaryPath });

  const summary = await readFile(ctx.summaryPath, 'utf8');

  expect(summary).toBe(
    [
      '## Install',
      '## Drift (prod)',
      '',
      '```text',
      '  ~ github:index/issueLabel:IssueLabel bug update',
      'error: 1 change found',
      '```',
      '',
    ].join('\n'),
  );
});

test("it returns the pulumi command's exit code when the step fails", async () => {
  const ctx = await setupTest();

  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'op', {
    script: "#!/bin/sh\necho 'error: 1 change found' >&2\nexit 255",
  });

  const result = await runInfraStep({
    infraPath: ctx.directory,
    stepName: 'drift-before',
    summaryPath: ctx.summaryPath,
  });

  expect(result).toStrictEqual({ exitCode: 255, output: 'error: 1 change found\n' });
});

test('it says the step wrote nothing when the command printed no output', async () => {
  const ctx = await setupTest();

  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);
  createStubBin(stubDirectory, 'op', { script: '#!/bin/sh\nexit 1' });

  await runInfraStep({ infraPath: ctx.directory, stepName: 'apply', summaryPath: ctx.summaryPath });

  const summary = await readFile(ctx.summaryPath, 'utf8');

  expect(summary).toBe('## Apply (prod)\n\n```text\nthe step wrote no output (exit 1)\n```\n');
});

test('it refuses a step name the workflows never use, and runs nothing', async () => {
  const ctx = await setupTest();

  const recordPath = join(ctx.directory, 'record');
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);
  createStubBin(stubDirectory, 'op', { script: `#!/bin/sh\ntouch '${recordPath}'` });

  const result = await runInfraStep({
    infraPath: ctx.directory,
    stepName: 'destroy',
    summaryPath: ctx.summaryPath,
  });

  expect(result).toStrictEqual({
    exitCode: 2,
    output:
      "infra-step: no step named 'destroy'; name one of drift, drift-before, change, apply, drift-after\n",
  });

  expect(Bun.file(recordPath).exists()).resolves.toBeFalse();
});
