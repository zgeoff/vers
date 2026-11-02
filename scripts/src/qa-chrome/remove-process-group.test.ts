import { expect, onTestFinished, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { waitFor } from '@vers/test-utils';
import invariant from 'tiny-invariant';
import { readProcessStartTime } from './read-process-start-time';
import { removeProcessGroup } from './remove-process-group';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'qa-chrome-group-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  return { helperPIDFile: join(directory, 'helper.pid') };
}

test('it waits for a process that outlives the group leader', async () => {
  const ctx = await setupTest();

  const leader = spawn(
    'sh',
    [
      '-c',
      `(trap 'sleep 1; exit 0' TERM; while :; do sleep 0.1; done) & echo $! > '${ctx.helperPIDFile}'; wait`,
    ],
    { detached: true, stdio: 'ignore' },
  );

  const groupID = leader.pid;

  invariant(groupID !== undefined, 'sh spawns with a process ID');
  onTestFinished(() => removeProcessGroup(groupID, 0));

  const helperPIDText = await waitFor(async () => {
    const text = await readFile(ctx.helperPIDFile, 'utf8');

    expect(text).toMatch(/^\d+\n$/u);

    return text;
  });

  await removeProcessGroup(groupID, 5000);

  const helperStartTime = await readProcessStartTime(Number(helperPIDText));

  expect(helperStartTime).toBeUndefined();
});

test('it kills a process that ignores SIGTERM once the grace period ends', async () => {
  const ctx = await setupTest();

  const leader = spawn(
    'sh',
    ['-c', `(trap '' TERM; while :; do sleep 0.1; done) & echo $! > '${ctx.helperPIDFile}'; wait`],
    { detached: true, stdio: 'ignore' },
  );

  const groupID = leader.pid;

  invariant(groupID !== undefined, 'sh spawns with a process ID');
  onTestFinished(() => removeProcessGroup(groupID, 0));

  const helperPIDText = await waitFor(async () => {
    const text = await readFile(ctx.helperPIDFile, 'utf8');

    expect(text).toMatch(/^\d+\n$/u);

    return text;
  });

  await removeProcessGroup(groupID, 200);

  const helperStartTime = await readProcessStartTime(Number(helperPIDText));

  expect(helperStartTime).toBeUndefined();
});
