import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { waitFor } from '@vers/test-utils';
import { startStubDevTools } from '../test-utils/start-stub-devtools';

async function setupTest() {
  const stateHome = await mkdtemp(join(tmpdir(), 'qa-cdp-bin-'));

  onTestFinished(() => rm(stateHome, { force: true, recursive: true }));

  const devtools = startStubDevTools();
  const bin = join(import.meta.dir, 'qa-cdp.ts');

  const runQACDP = async (args: ReadonlyArray<string>) => {
    const child = Bun.spawn([process.execPath, bin, ...args], {
      env: { PATH: '', QA_CDP_ENDPOINT: devtools.endpoint, XDG_STATE_HOME: stateHome },
      stderr: 'pipe',
      stdout: 'pipe',
    });

    const exitCode = await child.exited;

    const stdout = await new Response(child.stdout).text();
    const stderr = await new Response(child.stderr).text();

    return { exitCode, stderr, stdout };
  };

  return { devtools, runQACDP };
}

test('it keeps a target offline after offline on returns', async () => {
  const ctx = await setupTest();

  ctx.devtools.openTarget({ id: 'PAGE1', type: 'page' });

  const result = await ctx.runQACDP(['offline', 'PAGE1', 'on']);

  expect(result).toStrictEqual({ exitCode: 0, stderr: '', stdout: 'offline on\n' });
  expect(ctx.devtools.getFetchOutcome('PAGE1')).toBe('failed');
});

test('it brings a held target back online on offline off', async () => {
  const ctx = await setupTest();

  ctx.devtools.openTarget({ id: 'WORKER1', type: 'shared_worker' });

  await ctx.runQACDP(['offline', 'WORKER1', 'on']);

  const result = await ctx.runQACDP(['offline', 'WORKER1', 'off']);

  expect(result).toStrictEqual({ exitCode: 0, stderr: '', stdout: 'offline off\n' });

  await waitFor(() => {
    expect(ctx.devtools.getFetchOutcome('WORKER1')).toBe('ok');
  });
});

test('it keeps one hold when offline on runs twice, so one offline off ends the cut', async () => {
  const ctx = await setupTest();

  ctx.devtools.openTarget({ id: 'SERVICE1', type: 'service_worker' });

  await ctx.runQACDP(['offline', 'SERVICE1', 'on']);
  await ctx.runQACDP(['offline', 'SERVICE1', 'on']);
  await ctx.runQACDP(['offline', 'SERVICE1', 'off']);

  await waitFor(() => {
    expect(ctx.devtools.getFetchOutcome('SERVICE1')).toBe('ok');
  });
});

test('it refuses offline on for a target the endpoint does not list', async () => {
  const ctx = await setupTest();
  const result = await ctx.runQACDP(['offline', 'MISSING1', 'on']);

  expect(result).toStrictEqual({
    exitCode: 1,
    stderr: `qa-cdp: no target MISSING1 at ${ctx.devtools.endpoint}\n`,
    stdout: '',
  });
});
