import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildChromePaths } from './build-chrome-paths';
import { readChromeState } from './read-chrome-state';
import { readProcessStartTime } from './read-process-start-time';
import { writeChromeState } from './write-chrome-state';

async function setupTest() {
  const stateHome = await mkdtemp(join(tmpdir(), 'qa-chrome-state-'));

  onTestFinished(() => rm(stateHome, { force: true, recursive: true }));

  const leader = Bun.spawn(['sleep', '30']);

  onTestFinished(() => {
    leader.kill('SIGKILL');
  });

  return { leader, paths: buildChromePaths(stateHome, '/unused') };
}

test('it reads no state before a browser starts', async () => {
  const ctx = await setupTest();
  const running = await readChromeState(ctx.paths);

  expect(running).toBeUndefined();
});

test('it reads the state of a browser whose process still runs', async () => {
  const ctx = await setupTest();
  const leaderStartTime = await readProcessStartTime(ctx.leader.pid);

  const state = {
    leaderPID: ctx.leader.pid,
    leaderStartTime: leaderStartTime ?? '',
    namespace: { cut: null, holderPID: 4102 },
    port: 9222,
  };

  await writeChromeState(ctx.paths, state);

  const running = await readChromeState(ctx.paths);

  expect(running).toStrictEqual(state);
});

test('it reads no state when the process ID now belongs to another process', async () => {
  const ctx = await setupTest();

  await writeChromeState(ctx.paths, {
    leaderPID: ctx.leader.pid,
    leaderStartTime: '1',
    namespace: null,
    port: 9222,
  });

  const running = await readChromeState(ctx.paths);

  expect(running).toBeUndefined();
});
