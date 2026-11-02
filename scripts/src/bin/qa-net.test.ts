import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildChromePaths } from '../qa-chrome/build-chrome-paths';
import { readProcessStartTime } from '../qa-chrome/read-process-start-time';
import { writeChromeState } from '../qa-chrome/write-chrome-state';

async function setupTest() {
  const stateHome = await mkdtemp(join(tmpdir(), 'qa-net-bin-'));

  onTestFinished(() => rm(stateHome, { force: true, recursive: true }));

  return { bin: join(import.meta.dir, 'qa-net.ts'), stateHome };
}

test.each(['cut', 'restore', 'status'])('it refuses %s when no browser runs', async (command) => {
  const ctx = await setupTest();

  const child = Bun.spawn([process.execPath, ctx.bin, command], {
    env: { PATH: '', XDG_STATE_HOME: ctx.stateHome },
    stderr: 'pipe',
  });

  const exitCode = await child.exited;

  const stderr = await new Response(child.stderr).text();

  expect({ exitCode, stderr }).toStrictEqual({
    exitCode: 1,
    stderr:
      'qa-net: no qa:chrome browser is running; start one with bun run qa:chrome start --netns\n',
  });
});

test('it refuses a cut of a browser that runs without a namespace', async () => {
  const ctx = await setupTest();

  const leader = Bun.spawn(['sleep', '30']);

  onTestFinished(() => {
    leader.kill('SIGKILL');
  });

  const leaderStartTime = await readProcessStartTime(leader.pid);

  await writeChromeState(buildChromePaths(ctx.stateHome, '/unused'), {
    leaderPID: leader.pid,
    leaderStartTime: leaderStartTime ?? '',
    namespace: null,
    port: 9222,
  });

  const child = Bun.spawn([process.execPath, ctx.bin, 'cut'], {
    env: { PATH: '', XDG_STATE_HOME: ctx.stateHome },
    stderr: 'pipe',
  });

  const exitCode = await child.exited;

  const stderr = await new Response(child.stderr).text();

  expect({ exitCode, stderr }).toStrictEqual({
    exitCode: 1,
    stderr:
      'qa-net: the qa:chrome browser runs without a network namespace; restart it with bun run qa:chrome start --netns\n',
  });
});
