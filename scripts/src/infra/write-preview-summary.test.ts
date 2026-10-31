import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writePreviewSummary } from './write-preview-summary';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'preview-summary-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  return { directory };
}

test('it appends the preview output to the step summary', async () => {
  const ctx = await setupTest();

  const outputPath = join(ctx.directory, 'preview.txt');
  const summaryPath = join(ctx.directory, 'summary.md');

  await writeFile(outputPath, 'Resources:\n    12 unchanged\n');
  await writeFile(summaryPath, '## Install\n');
  await writePreviewSummary({ outputPath, summaryPath });

  const summary = await readFile(summaryPath, 'utf8');

  expect(summary).toBe(
    '## Install\n## Pulumi preview (prod)\n\n```text\nResources:\n    12 unchanged\n```\n',
  );
});

test('it says the preview wrote nothing when the preview step left no output file', async () => {
  const ctx = await setupTest();

  const summaryPath = join(ctx.directory, 'summary.md');

  await writePreviewSummary({ outputPath: join(ctx.directory, 'preview.txt'), summaryPath });

  const summary = await readFile(summaryPath, 'utf8');

  expect(summary).toBe(
    '## Pulumi preview (prod)\n\n```text\nthe preview step wrote no output\n```\n',
  );
});
