import { expect, mock, onTestFinished, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withCommandLock } from './with-command-lock';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'command-lock-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  return { lockFile: join(directory, 'state', 'state.lock') };
}

test('it runs the command and returns its result, creating the lock directory', async () => {
  const ctx = await setupTest();
  const result = await withCommandLock(ctx.lockFile, 1000, () => Promise.resolve('ran'));

  expect(result).toBe('ran');
});

test('it refuses to run while another command holds the lock', async () => {
  const ctx = await setupTest();

  const run = mock(() => Promise.resolve('ran'));
  const nested = withCommandLock(ctx.lockFile, 1000, () => withCommandLock(ctx.lockFile, 50, run));

  expect(nested).rejects.toThrow(`another command still holds ${ctx.lockFile} after 50 ms`);
  expect(run).not.toHaveBeenCalled();
});
