import { expect, onTestFinished, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildChromePaths } from '../qa-chrome/build-chrome-paths';
import { readProcessStartTime } from '../qa-chrome/read-process-start-time';
import { removeProcessGroup } from '../qa-chrome/remove-process-group';
import { createStubCommand } from '../test-utils/create-stub-command';

async function setupTest() {
  const stateHome = await mkdtemp(join(tmpdir(), 'qa-chrome-bin-'));

  onTestFinished(() => rm(stateHome, { force: true, recursive: true }));

  return { bin: join(import.meta.dir, 'qa-chrome.ts'), stateHome };
}

test('it refuses a --netns start when pasta is not on PATH', async () => {
  const ctx = await setupTest();
  const chromium = await createStubCommand('chromium', 'exit 1');

  const child = Bun.spawn([process.execPath, ctx.bin, 'start', '--netns'], {
    env: { PATH: dirname(chromium), TMPDIR: '/tmp', XDG_STATE_HOME: ctx.stateHome },
    stderr: 'pipe',
  });

  const exitCode = await child.exited;

  const stderr = await new Response(child.stderr).text();

  expect({ exitCode, stderr }).toStrictEqual({
    exitCode: 1,
    stderr:
      'qa-chrome: --netns needs pasta, which is not on PATH; install the passt package, such as with sudo pacman -S passt\n',
  });
});

test('it refuses a start when chromium is not on PATH', async () => {
  const ctx = await setupTest();
  const pasta = await createStubCommand('pasta', 'exit 1');

  const child = Bun.spawn([process.execPath, ctx.bin, 'start', '--netns'], {
    env: { PATH: dirname(pasta), TMPDIR: '/tmp', XDG_STATE_HOME: ctx.stateHome },
    stderr: 'pipe',
  });

  const exitCode = await child.exited;

  const stderr = await new Response(child.stderr).text();

  expect({ exitCode, stderr }).toStrictEqual({
    exitCode: 1,
    stderr:
      'qa-chrome: chromium is not on PATH; install it, such as with sudo pacman -S chromium\n',
  });
});

test('it refuses a start under a TMPDIR too long for Chromium', async () => {
  const ctx = await setupTest();
  const chromium = await createStubCommand('chromium', 'exit 1');
  const pasta = await createStubCommand('pasta', 'exit 1');

  const child = Bun.spawn([process.execPath, ctx.bin, 'start', '--netns'], {
    env: {
      PATH: `${dirname(chromium)}:${dirname(pasta)}`,
      TMPDIR: `/${'t'.repeat(69)}`,
      XDG_STATE_HOME: ctx.stateHome,
    },
    stderr: 'pipe',
  });

  const exitCode = await child.exited;

  const stderr = await new Response(child.stderr).text();

  expect({ exitCode, stderr }).toStrictEqual({
    exitCode: 1,
    stderr:
      'qa-chrome: TMPDIR is 70 bytes, and Chromium fails with "Socket path too long" over 62; rerun with a shorter one, such as TMPDIR=$XDG_RUNTIME_DIR\n',
  });
});

test('it stops the browser it launched when the state file cannot be written', async () => {
  const ctx = await setupTest();

  const listener = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data: () => {} } });
  const port = listener.port;

  listener.stop(true);

  const pidFile = join(ctx.stateHome, 'browser.pid');
  const fakeBrowser = `Bun.serve({ hostname: '127.0.0.1', port: ${port}, fetch: () => Response.json({}) })`;

  const chromium = await createStubCommand(
    'chromium',
    `echo $$ > '${pidFile}'\nexec '${process.execPath}' -e "${fakeBrowser}"`,
  );

  const paths = buildChromePaths(ctx.stateHome, '/unused');

  await mkdir(paths.directory, { recursive: true });

  await writeFile(
    paths.stateFile,
    JSON.stringify({ leaderPID: process.pid, leaderStartTime: 'stale', namespace: null, port }),
    { mode: 0o444 },
  );

  const child = Bun.spawn([process.execPath, ctx.bin, 'start', '--port', String(port)], {
    env: { PATH: dirname(chromium), TMPDIR: '/tmp', XDG_STATE_HOME: ctx.stateHome },
    stderr: 'pipe',
  });

  const exitCode = await child.exited;

  const stderr = await new Response(child.stderr).text();

  const browserPIDText = await readFile(pidFile, 'utf8');

  const browserPID = Number(browserPIDText);

  onTestFinished(() => removeProcessGroup(browserPID, 0));

  const browserStartTime = await readProcessStartTime(browserPID);

  expect({ exitCode, stderr }).toStrictEqual({
    exitCode: 1,
    stderr: `qa-chrome: EACCES: permission denied, open '${paths.stateFile}'\n`,
  });

  expect(browserStartTime).toBeUndefined();
});

test('it refuses a stop when no browser runs', async () => {
  const ctx = await setupTest();

  const child = Bun.spawn([process.execPath, ctx.bin, 'stop'], {
    env: { PATH: '', XDG_STATE_HOME: ctx.stateHome },
    stderr: 'pipe',
  });

  const exitCode = await child.exited;

  const stderr = await new Response(child.stderr).text();

  expect({ exitCode, stderr }).toStrictEqual({
    exitCode: 1,
    stderr:
      'qa-chrome: no qa:chrome browser is running; start one with bun run qa:chrome start --netns\n',
  });
});
