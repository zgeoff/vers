import { expect, mock, onTestFinished, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { waitFor } from '@vers/test-utils';
import { withFileLock } from './with-file-lock';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'file-lock-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  return {
    heldFile: join(directory, 'held'),
    lockFile: join(directory, 'state', 'state.lock'),
    lockModule: join(import.meta.dir, 'with-file-lock.ts'),
  };
}

test('it refuses to run while another process holds the lock', async () => {
  const ctx = await setupTest();

  const holder = Bun.spawn([
    process.execPath,
    '-e',
    `const { withFileLock } = await import(${JSON.stringify(ctx.lockModule)});
     await withFileLock(${JSON.stringify(ctx.lockFile)}, 1000, async () => {
       await Bun.write(${JSON.stringify(ctx.heldFile)}, 'held');
       await Bun.sleep(30_000);
     });`,
  ]);

  onTestFinished(() => {
    holder.kill('SIGKILL');
  });

  await waitFor(async () => {
    const text = await readFile(ctx.heldFile, 'utf8');

    expect(text).toBe('held');
  });

  const run = mock(() => Promise.resolve('ran'));

  expect(withFileLock(ctx.lockFile, 300, run)).rejects.toThrow(
    `another command still holds ${ctx.lockFile} after 300 ms`,
  );

  expect(run).not.toHaveBeenCalled();
});

test('it takes the lock once the process that held it dies', async () => {
  const ctx = await setupTest();

  const holder = Bun.spawn([
    process.execPath,
    '-e',
    `const { withFileLock } = await import(${JSON.stringify(ctx.lockModule)});
     await withFileLock(${JSON.stringify(ctx.lockFile)}, 1000, async () => {
       await Bun.write(${JSON.stringify(ctx.heldFile)}, 'held');
       await Bun.sleep(30_000);
     });`,
  ]);

  await waitFor(async () => {
    const text = await readFile(ctx.heldFile, 'utf8');

    expect(text).toBe('held');
  });

  holder.kill('SIGKILL');

  await holder.exited;

  const result = await withFileLock(ctx.lockFile, 1000, () => Promise.resolve('ran'));

  expect(result).toBe('ran');
});
