import { expect, onTestFinished, test } from 'bun:test';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'bun';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'launch-chromium-'));

  onTestFinished(() => rm(directory, { recursive: true, force: true }));

  return { directory, scriptPath: join(import.meta.dir, 'launch-chromium.sh') };
}

test('it starts Chromium with a loopback DevTools port, the driver arguments, and a short TMPDIR', async () => {
  const ctx = await setupTest();

  const chromiumPath = join(ctx.directory, 'chromium');

  await writeFile(
    chromiumPath,
    '#!/usr/bin/env bash\necho "TMPDIR=$TMPDIR"\nprintf "%s\\n" "$@"\n',
  );

  await chmod(chromiumPath, 0o755);

  const result = await $`sh ${ctx.scriptPath} --remote-debugging-pipe ${'--user-data-dir=/x y'}`
    .env({
      ...process.env,
      TMPDIR: join(ctx.directory, 'a-long-session-folder'),
      VERS_VERIFY_CHROMIUM: chromiumPath,
      VERS_VERIFY_DEVTOOLS_PORT: '9333',
    })
    .nothrow()
    .quiet();

  expect({
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  }).toStrictEqual({
    exitCode: 0,
    stdout:
      'TMPDIR=/tmp\n--remote-debugging-address=127.0.0.1\n--remote-debugging-port=9333\n--remote-debugging-pipe\n--user-data-dir=/x y\n',
    stderr: '',
  });
});

test('it fails with the install command when no Chromium is at the configured path', async () => {
  const ctx = await setupTest();

  const chromiumPath = join(ctx.directory, 'missing-chromium');

  const result = await $`sh ${ctx.scriptPath}`
    .env({ ...process.env, VERS_VERIFY_CHROMIUM: chromiumPath, VERS_VERIFY_DEVTOOLS_PORT: '9333' })
    .nothrow()
    .quiet();

  expect({
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  }).toStrictEqual({
    exitCode: 1,
    stdout: '',
    stderr: `launch-chromium: no Chromium at VERS_VERIFY_CHROMIUM='${chromiumPath}'; run: bun run verify:install-browser\n`,
  });
});
