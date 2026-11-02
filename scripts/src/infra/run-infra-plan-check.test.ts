import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStubCommand } from '../test-utils/create-stub-command';
import { runInfraPlanCheck } from './run-infra-plan-check';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'infra-plan-check-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  const outputPath = join(directory, 'output');
  const summaryPath = join(directory, 'summary.md');

  await writeFile(outputPath, '');
  await writeFile(summaryPath, '');

  return { directory, outputPath, summaryPath };
}

test('it previews the prod stack as JSON with a refresh', async () => {
  const ctx = await setupTest();

  const recordPath = join(ctx.directory, 'record');

  await createStubCommand('op', `shift 5\necho "$*" > '${recordPath}'\necho '{"steps": []}'`);

  await runInfraPlanCheck({
    drift: 'success',
    event: 'push',
    infraPath: ctx.directory,
    outputPath: ctx.outputPath,
    summaryPath: ctx.summaryPath,
  });

  const record = await readFile(recordPath, 'utf8');

  expect(record).toBe('preview --refresh --json\n');
});

test('it passes a plan that creates and updates resources, and reports it in the step summary', async () => {
  const ctx = await setupTest();

  const plan = JSON.stringify({
    steps: [
      { op: 'create', urn: 'urn:pulumi:prod::vers-infra::axiom:index/monitor:Monitor::errors' },
      { op: 'update', urn: 'urn:pulumi:prod::vers-infra::github:index/issueLabel:IssueLabel::bug' },
    ],
  });

  await createStubCommand('op', `printf '%s\\n' '${plan}'`);

  const result = await runInfraPlanCheck({
    drift: 'success',
    event: 'push',
    infraPath: ctx.directory,
    outputPath: ctx.outputPath,
    summaryPath: ctx.summaryPath,
  });

  const outputs = await readFile(ctx.outputPath, 'utf8');
  const summary = await readFile(ctx.summaryPath, 'utf8');

  expect(result.exitCode).toBe(0);
  expect(outputs).toBe('outcome=apply\n');
  expect(summary).toBe(result.output);

  expect(summary).toBe(
    [
      '## Apply plan (prod)',
      '',
      'The guard passed the plan, so the job applies it.',
      '',
      '| Op | Resource |',
      '| --- | --- |',
      '| `create` | `urn:pulumi:prod::vers-infra::axiom:index/monitor:Monitor::errors` |',
      '| `update` | `urn:pulumi:prod::vers-infra::github:index/issueLabel:IssueLabel::bug` |',
      '',
    ].join('\n'),
  );
});

test('it holds a plan that replaces a resource', async () => {
  const ctx = await setupTest();

  const urn = 'urn:pulumi:prod::vers-infra::cloudflare:index/dnsRecord:DnsRecord::apex';

  const plan = JSON.stringify({
    steps: [
      { op: 'create-replacement', urn },
      { op: 'replace', urn },
      { op: 'delete-replaced', urn },
    ],
    changeSummary: { replace: 1 },
  });

  await createStubCommand('op', `printf '%s\\n' '${plan}'`);

  const result = await runInfraPlanCheck({
    drift: 'success',
    event: 'push',
    infraPath: ctx.directory,
    outputPath: ctx.outputPath,
    summaryPath: ctx.summaryPath,
  });

  const outputs = await readFile(ctx.outputPath, 'utf8');

  expect(result.exitCode).toBe(0);
  expect(outputs).toBe('outcome=held\n');

  expect(result.output).toContain(
    [
      'The guard held the plan for a person, for these reasons:',
      '',
      `- create-replacement ${urn}`,
      `- replace ${urn}`,
      `- delete-replaced ${urn}`,
    ].join('\n'),
  );
});

test('it holds a plan that changes nothing when the drift check before it failed', async () => {
  const ctx = await setupTest();

  await createStubCommand('op', `echo '{"steps": [], "changeSummary": {"same": 40}}'`);

  const result = await runInfraPlanCheck({
    drift: 'failure',
    event: 'push',
    infraPath: ctx.directory,
    outputPath: ctx.outputPath,
    summaryPath: ctx.summaryPath,
  });

  const outputs = await readFile(ctx.outputPath, 'utf8');

  expect(outputs).toBe('outcome=held\n');

  expect(result.output).toContain(
    '- the preview before this change found changes: drift, or an earlier change that the guard held\n',
  );
});

test('it applies a plan that deletes a resource when a person dispatched the run', async () => {
  const ctx = await setupTest();

  const plan = JSON.stringify({
    steps: [{ op: 'delete', urn: 'urn:pulumi:prod::vers-infra::neon:index/role:Role::reader' }],
  });

  await createStubCommand('op', `printf '%s\\n' '${plan}'`);

  const result = await runInfraPlanCheck({
    drift: 'skipped',
    event: 'workflow_dispatch',
    infraPath: ctx.directory,
    outputPath: ctx.outputPath,
    summaryPath: ctx.summaryPath,
  });

  const outputs = await readFile(ctx.outputPath, 'utf8');

  expect(result.exitCode).toBe(0);
  expect(outputs).toBe('outcome=apply\n');
});

test("it fails with the preview's errors and writes no outcome when the preview fails", async () => {
  const ctx = await setupTest();

  const plan = JSON.stringify({
    steps: [],
    diagnostics: [
      { severity: 'warning', message: 'provider is slow' },
      { severity: 'error', message: 'neon: 401 Unauthorized\n' },
    ],
  });

  await createStubCommand(
    'op',
    `printf '%s\\n' '${plan}'\necho 'error: preview failed' >&2\nexit 255`,
  );

  const result = await runInfraPlanCheck({
    drift: 'success',
    event: 'push',
    infraPath: ctx.directory,
    outputPath: ctx.outputPath,
    summaryPath: ctx.summaryPath,
  });

  const outputs = await readFile(ctx.outputPath, 'utf8');
  const summary = await readFile(ctx.summaryPath, 'utf8');

  expect(result.exitCode).toBe(1);
  expect(outputs).toBe('');

  expect(summary).toBe(
    [
      '## Apply plan (prod)',
      '',
      '```text',
      'the preview failed (exit 255)',
      'neon: 401 Unauthorized',
      'error: preview failed',
      '```',
      '',
    ].join('\n'),
  );
});

test('it fails and writes no outcome when the preview prints no plan', async () => {
  const ctx = await setupTest();

  await createStubCommand('op', "echo 'Previewing update (prod)'");

  const result = await runInfraPlanCheck({
    drift: 'success',
    event: 'push',
    infraPath: ctx.directory,
    outputPath: ctx.outputPath,
    summaryPath: ctx.summaryPath,
  });

  const outputs = await readFile(ctx.outputPath, 'utf8');

  expect(result).toStrictEqual({
    exitCode: 1,
    output: '## Apply plan (prod)\n\n```text\nthe preview printed no plan\n```\n',
  });

  expect(outputs).toBe('');
});
