import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStubCommand } from '../test-utils/create-stub-command';
import { runOutdatedReport } from './run-outdated-report';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'outdated-report-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  return { directory };
}

test('it appends the report to the step summary after what the summary holds', async () => {
  const ctx = await setupTest();

  const summaryPath = join(ctx.directory, 'summary.md');

  await writeFile(summaryPath, '## Audit\n');
  await createStubCommand('bun', String.raw`printf '| zod | 4.1.0 | 4.2.0 |\n'`);
  await runOutdatedReport({ cwd: ctx.directory, summaryPath });

  const summary = await readFile(summaryPath, 'utf8');

  expect(summary).toBe('## Audit\n## bun outdated\n\n```\n| zod | 4.1.0 | 4.2.0 |\n```\n');
});

test('it returns the report for the log', async () => {
  const ctx = await setupTest();

  await createStubCommand('bun', String.raw`printf '| zod | 4.1.0 | 4.2.0 |\n'`);

  const report = await runOutdatedReport({
    cwd: ctx.directory,
    summaryPath: join(ctx.directory, 'summary.md'),
  });

  expect(report).toBe('| zod | 4.1.0 | 4.2.0 |\n');
});

test('it runs bun outdated in the directory it is given', async () => {
  const ctx = await setupTest();

  const argsPath = join(ctx.directory, 'args');

  await createStubCommand('bun', `printf '%s %s\\n' "$PWD" "$*" > '${argsPath}'`);
  await runOutdatedReport({ cwd: ctx.directory, summaryPath: join(ctx.directory, 'summary.md') });

  const args = await readFile(argsPath, 'utf8');

  expect(args).toBe(`${ctx.directory} outdated\n`);
});

test('it rejects a bun outdated run that fails', async () => {
  const ctx = await setupTest();

  await createStubCommand('bun', "echo 'error: lockfile not found' >&2\nexit 1");

  expect(
    runOutdatedReport({ cwd: ctx.directory, summaryPath: join(ctx.directory, 'summary.md') }),
  ).rejects.toThrow();
});
