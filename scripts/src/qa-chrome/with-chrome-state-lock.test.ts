import { expect, mock, onTestFinished, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { waitFor } from '@vers/test-utils';
import { buildChromePaths } from './build-chrome-paths';
import { withChromeStateLock } from './with-chrome-state-lock';

async function setupTest() {
  const stateHome = await mkdtemp(join(tmpdir(), 'qa-chrome-lock-'));

  onTestFinished(() => rm(stateHome, { force: true, recursive: true }));

  return {
    heldFile: join(stateHome, 'held'),
    lockModule: join(import.meta.dir, 'with-chrome-state-lock.ts'),
    pathsModule: join(import.meta.dir, 'build-chrome-paths.ts'),
    stateHome,
  };
}

test('it refuses to run while another process holds the lock', async () => {
  const ctx = await setupTest();

  const holder = Bun.spawn([
    process.execPath,
    '-e',
    `const { buildChromePaths } = await import(${JSON.stringify(ctx.pathsModule)});
     const { withChromeStateLock } = await import(${JSON.stringify(ctx.lockModule)});
     await withChromeStateLock(buildChromePaths(${JSON.stringify(ctx.stateHome)}, '/unused'), 1000, async () => {
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
  const paths = buildChromePaths(ctx.stateHome, '/unused');

  expect(withChromeStateLock(paths, 300, run)).rejects.toThrow(
    `another qa:chrome or qa:net command still holds ${paths.lockFile} after 300 ms`,
  );

  expect(run).not.toHaveBeenCalled();
});

test('it takes the lock once the process that held it dies', async () => {
  const ctx = await setupTest();

  const holder = Bun.spawn([
    process.execPath,
    '-e',
    `const { buildChromePaths } = await import(${JSON.stringify(ctx.pathsModule)});
     const { withChromeStateLock } = await import(${JSON.stringify(ctx.lockModule)});
     await withChromeStateLock(buildChromePaths(${JSON.stringify(ctx.stateHome)}, '/unused'), 1000, async () => {
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

  const result = await withChromeStateLock(buildChromePaths(ctx.stateHome, '/unused'), 1000, () =>
    Promise.resolve('ran'),
  );

  expect(result).toBe('ran');
});
