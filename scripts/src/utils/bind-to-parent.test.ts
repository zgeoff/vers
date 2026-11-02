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

    // a read can land after another process creates the file and before it writes the pid, and an
    // empty read parses as 0, which signals the test's own process group
    const childPID = await waitFor(
      async () => {
        const pidText = await readFile(pidPath, 'utf8');

        const pid = Number(pidText);

        expect(pid).toBeGreaterThan(0);

        return pid;
      },
      { timeoutMs: 3000 },
    );

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

  const readyPath = join(ctx.directory, 'ready');
  const donePath = join(ctx.directory, 'done');
  const childScript = `trap 'sleep 0.3; echo done > "${donePath}"; exit 0' TERM\necho ready > "${readyPath}"\nwhile true; do sleep 0.05; done`;

  const parent = Bun.spawn([
    'bun',
    '-e',
    `import { bindToParent } from ${JSON.stringify(join(import.meta.dir, 'bind-to-parent.ts'))};
    const child = Bun.spawn(['sh', '-c', ${JSON.stringify(childScript)}]);
    bindToParent(child, { graceMs: 3000 });
    await child.exited;`,
  ]);

  onTestFinished(() => {
    parent.kill('SIGKILL');
  });

  // the child writes the marker only after its trap is set, so the signal never meets the shell's
  // default exit
  await waitFor(() => readFile(readyPath, 'utf8'), { timeoutMs: 3000 });

  parent.kill('SIGTERM');

  await parent.exited;

  expect(readFile(donePath, 'utf8')).resolves.toBe('done\n');
});

test('it kills a child that ignores its signal once the grace runs out', async () => {
  const ctx = await setupTest();

  const pidPath = join(ctx.directory, 'pid');
  const childScript = `trap '' TERM\necho $$ > "${pidPath}"\nwhile true; do sleep 0.05; done`;

  // the child writes its pid only after its trap is set, so the signal never meets the shell's
  // default exit
  const parent = Bun.spawn([
    'bun',
    '-e',
    `import { bindToParent } from ${JSON.stringify(join(import.meta.dir, 'bind-to-parent.ts'))};
    const child = Bun.spawn(['sh', '-c', ${JSON.stringify(childScript)}]);
    bindToParent(child, { graceMs: 200 });
    await child.exited;`,
  ]);

  onTestFinished(() => {
    parent.kill('SIGKILL');
  });

  const childPID = await waitFor(
    async () => {
      const pidText = await readFile(pidPath, 'utf8');

      const pid = Number(pidText);

      expect(pid).toBeGreaterThan(0);

      return pid;
    },
    { timeoutMs: 3000 },
  );

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
