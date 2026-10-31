import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStubCommand } from '../test-utils/create-stub-command';
import { runPulumiPreview } from './run-pulumi-preview';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'pulumi-preview-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  return { directory };
}

test('it previews the prod stack against the R2 state backend from the directory it is given', async () => {
  const ctx = await setupTest();

  const recordPath = join(ctx.directory, 'record');

  await createStubCommand(
    'pulumi',
    `printf '%s\\n%s\\n%s\\n' "$PWD" "$PULUMI_BACKEND_URL" "$*" > '${recordPath}'`,
  );

  const exitCode = await runPulumiPreview({
    cwd: ctx.directory,
    env: { ...process.env, R2_STATE_BUCKET: 'kiln-state', CLOUDFLARE_ACCOUNT_ID: '0a1b2c3d' },
  });

  const record = await readFile(recordPath, 'utf8');

  expect(exitCode).toBe(0);

  expect(record).toBe(
    [
      ctx.directory,
      's3://kiln-state?endpoint=0a1b2c3d.r2.cloudflarestorage.com&region=auto&s3ForcePathStyle=true',
      'preview --stack prod --refresh --diff --expect-no-changes --non-interactive --color never',
      '',
    ].join('\n'),
  );
});

test("it returns pulumi's exit code when the preview finds changes", async () => {
  const ctx = await setupTest();

  await createStubCommand('pulumi', 'exit 255');

  const exitCode = await runPulumiPreview({
    cwd: ctx.directory,
    env: { ...process.env, R2_STATE_BUCKET: 'kiln-state', CLOUDFLARE_ACCOUNT_ID: '0a1b2c3d' },
  });

  expect(exitCode).toBe(255);
});

test('it rejects an env without the state bucket', async () => {
  const ctx = await setupTest();

  expect(
    runPulumiPreview({ cwd: ctx.directory, env: { CLOUDFLARE_ACCOUNT_ID: '0a1b2c3d' } }),
  ).rejects.toMatchObject({ issues: [{ path: ['R2_STATE_BUCKET'] }] });
});
