import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { waitFor } from '@vers/test-utils';
import { bindToParent } from './bind-to-parent';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'bind-to-parent-'));

  onTestFinished(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  return { directory };
}

test.each([
  ['SIGHUP', 129],
  ['SIGINT', 130],
  ['SIGTERM', 143],
] as const)(
  'it kills the child and exits like the default handler when the parent gets %s',
  async (signal, exitCode) => {
    const ctx = await setupTest();

    const pidPath = join(ctx.directory, 'pid');

    const parent = Bun.spawn([
      'bun',
      '-e',
      `import { bindToParent } from ${JSON.stringify(join(import.meta.dir, 'bind-to-parent.ts'))};
      const child = Bun.spawn(['sleep', '30']);
      bindToParent(child);
      await Bun.write(${JSON.stringify(pidPath)}, String(child.pid));
      await child.exited;`,
    ]);

    onTestFinished(() => {
      parent.kill('SIGKILL');
    });

    const pidText = await waitFor(() => readFile(pidPath, 'utf8'), { timeoutMs: 3000 });

    const childPID = Number(pidText);

    parent.kill(signal);

    const parentExitCode = await parent.exited;

    expect(parentExitCode).toBe(exitCode);

    await waitFor(() => {
      expect(() => process.kill(childPID, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
    });
  },
);

test('it waits for the child to exit before the parent exits', async () => {
  const ctx = await setupTest();

  const pidPath = join(ctx.directory, 'pid');
  const donePath = join(ctx.directory, 'done');
  const childScript = `trap 'sleep 0.3; echo done > "${donePath}"; exit 0' TERM\nwhile true; do sleep 0.05; done`;

  const parent = Bun.spawn([
    'bun',
    '-e',
    `import { bindToParent } from ${JSON.stringify(join(import.meta.dir, 'bind-to-parent.ts'))};
    const child = Bun.spawn(['sh', '-c', ${JSON.stringify(childScript)}]);
    bindToParent(child, { graceMs: 3000 });
    await Bun.write(${JSON.stringify(pidPath)}, String(child.pid));
    await child.exited;`,
  ]);

  onTestFinished(() => {
    parent.kill('SIGKILL');
  });

  await waitFor(() => readFile(pidPath, 'utf8'), { timeoutMs: 3000 });

  parent.kill('SIGTERM');

  await parent.exited;

  expect(readFile(donePath, 'utf8')).resolves.toBe('done\n');
});

test('it kills a child that ignores its signal once the grace runs out', async () => {
  const ctx = await setupTest();

  const pidPath = join(ctx.directory, 'pid');

  const parent = Bun.spawn([
    'bun',
    '-e',
    `import { bindToParent } from ${JSON.stringify(join(import.meta.dir, 'bind-to-parent.ts'))};
    const child = Bun.spawn(['sh', '-c', "trap '' TERM\\nwhile true; do sleep 0.05; done"]);
    bindToParent(child, { graceMs: 200 });
    await Bun.write(${JSON.stringify(pidPath)}, String(child.pid));
    await child.exited;`,
  ]);

  onTestFinished(() => {
    parent.kill('SIGKILL');
  });

  const pidText = await waitFor(() => readFile(pidPath, 'utf8'), { timeoutMs: 3000 });

  const childPID = Number(pidText);

  parent.kill('SIGTERM');

  const parentExitCode = await parent.exited;

  expect(parentExitCode).toBe(143);
  expect(() => process.kill(childPID, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
});

test('it removes its listeners once the child exits', async () => {
  const listenersBefore = process.listenerCount('SIGTERM');
  const child = Bun.spawn(['true']);

  bindToParent(child);

  await child.exited;

  expect(process.listenerCount('SIGTERM')).toBe(listenersBefore);
});
