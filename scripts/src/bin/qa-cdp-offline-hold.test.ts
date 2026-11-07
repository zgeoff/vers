import { expect, onTestFinished, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { waitFor } from '@vers/test-utils';
import { buildOfflineHoldPaths } from '../qa/build-offline-hold-paths';
import { readOfflineHoldFailures } from '../qa/read-offline-hold-failures';
import { startStubDevTools } from '../test-utils/start-stub-devtools';

async function setupTest() {
  const stateHome = await mkdtemp(join(tmpdir(), 'qa-cdp-offline-hold-'));

  onTestFinished(() => rm(stateHome, { force: true, recursive: true }));

  const devtools = startStubDevTools();
  const bin = join(import.meta.dir, 'qa-cdp-offline-hold.ts');
  const buildPaths = (targetID: string) => buildOfflineHoldPaths(stateHome, stateHome, targetID);

  const startHold = async (targetID: string) => {
    const paths = buildPaths(targetID);

    await mkdir(paths.directory, { recursive: true });

    const hold = Bun.spawn(
      [process.execPath, bin, '--endpoint', devtools.endpoint, '--log', paths.logFile, targetID],
      { stdin: 'pipe', stdout: 'ignore' },
    );

    onTestFinished(() => {
      hold.kill('SIGKILL');
    });

    return hold;
  };

  const readFailures = (targetID: string) => readOfflineHoldFailures(buildPaths(targetID));

  return { devtools, readFailures, startHold };
}

test('it ends the hold when stdin closes before the parent confirms the save', async () => {
  const ctx = await setupTest();

  ctx.devtools.openTarget({ id: 'PAGE1', type: 'page' });

  const hold = await ctx.startHold('PAGE1');

  await waitFor(() => {
    expect(ctx.devtools.getFetchOutcome('PAGE1')).toBe('failed');
  });

  await hold.stdin.end();

  const exitCode = await hold.exited;

  expect(exitCode).toBe(0);

  await waitFor(() => {
    expect(ctx.devtools.getFetchOutcome('PAGE1')).toBe('ok');
  });
});

test('it resumes a held shared worker that restarts', async () => {
  const ctx = await setupTest();

  ctx.devtools.openTarget({ id: 'WORKER1', type: 'shared_worker' });

  await ctx.startHold('WORKER1');

  await waitFor(() => {
    expect(ctx.devtools.getFetchOutcome('WORKER1')).toBe('failed');
  });

  ctx.devtools.restartTarget('WORKER1');

  await waitFor(() => {
    expect(ctx.devtools.isTargetPaused('WORKER1')).toBeFalse();
  });
});

test('it logs a failed resume of a held shared worker that restarts', async () => {
  const ctx = await setupTest();

  ctx.devtools.openTarget({
    id: 'WORKER1',
    refusedMethods: ['Runtime.runIfWaitingForDebugger'],
    type: 'shared_worker',
  });

  await ctx.startHold('WORKER1');

  await waitFor(() => {
    expect(ctx.devtools.getFetchOutcome('WORKER1')).toBe('failed');
  });

  ctx.devtools.restartTarget('WORKER1');

  await waitFor(async () => {
    const failures = await ctx.readFailures('WORKER1');

    expect(failures).toBe(
      'hold WORKER1: Runtime.runIfWaitingForDebugger: the target refused Runtime.runIfWaitingForDebugger\n',
    );
  });
});
