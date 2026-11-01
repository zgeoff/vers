import { expect, onTestFinished, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { waitFor } from '@vers/test-utils';
import { createStubCommand } from '../test-utils/create-stub-command';
import { runFlyctl } from './run-flyctl';

test('it returns what flyctl wrote to stdout', async () => {
  await createStubCommand('flyctl', 'echo "$@"');

  expect(runFlyctl(['machines', 'list', '--json'])).resolves.toBe('machines list --json\n');
});

test('it rejects with the exit code and stderr of a flyctl call that fails', async () => {
  await createStubCommand('flyctl', 'echo "app not found" >&2\nexit 1');

  expect(runFlyctl(['status', '--app', 'vers-missing'])).rejects.toMatchObject({
    exitCode: 1,
    message: 'flyctl status --app vers-missing failed with exit code 1\napp not found',
    stderr: 'app not found\n',
  });
});

test('it ends flyctl when the process that ran it gets SIGTERM', async () => {
  const flyctlPath = await createStubCommand(
    'flyctl',
    'echo $$ > "$(dirname "$0")/pid"\nexec sleep 30',
  );

  const pidPath = join(dirname(flyctlPath), 'pid');

  const cli = Bun.spawn(
    [
      'bun',
      '-e',
      `import { runFlyctl } from ${JSON.stringify(join(import.meta.dir, 'run-flyctl.ts'))};
      await runFlyctl(['machines', 'list']);`,
    ],
    { env: process.env },
  );

  onTestFinished(() => {
    cli.kill('SIGKILL');
  });

  const pidText = await waitFor(() => readFile(pidPath, 'utf8'), { timeoutMs: 3000 });

  const flyctlPID = Number(pidText);

  cli.kill('SIGTERM');

  await cli.exited;

  await waitFor(() => {
    expect(() => process.kill(flyctlPID, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
  });
});

test('it ends a flyctl call that is still pending when the cancel signal aborts', async () => {
  await createStubCommand('flyctl', 'exec sleep 30');

  expect(
    runFlyctl(['machines', 'list'], { cancelSignal: AbortSignal.timeout(50) }),
  ).rejects.toMatchObject({ signal: 'SIGTERM' });
});

test('it sends SIGINT to a flyctl call that outlives its interrupt deadline', async () => {
  await createStubCommand(
    'flyctl',
    "trap 'echo interrupted; exit 130' INT\nwhile true; do sleep 0.05; done",
  );

  expect(
    runFlyctl(['deploy'], { interrupt: { afterMs: 100, graceMs: 2000 } }),
  ).rejects.toMatchObject({ exitCode: 130, stdout: 'interrupted\n' });
});

test('it sends SIGINT to a flyctl call that writes nothing for its stall deadline', async () => {
  await createStubCommand(
    'flyctl',
    "trap 'echo interrupted; exit 130' INT\necho started\nwhile true; do sleep 0.05; done",
  );

  expect(
    runFlyctl(['deploy'], { stallInterrupt: { afterMs: 200, graceMs: 2000 } }),
  ).rejects.toMatchObject({
    exitCode: 130,
    message:
      'flyctl deploy wrote nothing for 200 ms and was interrupted, ending with exit code 130',
    stalledAfterMs: 200,
    stdout: 'started\ninterrupted\n',
  });
});

test('it leaves a flyctl call that keeps writing past its stall deadline', async () => {
  await createStubCommand('flyctl', 'for step in 1 2 3 4 5 6; do echo "#$step"; sleep 0.1; done');

  expect(runFlyctl(['deploy'], { stallInterrupt: { afterMs: 300, graceMs: 100 } })).resolves.toBe(
    '#1\n#2\n#3\n#4\n#5\n#6\n',
  );
});

test('it fails a stalled flyctl call that exits cleanly on SIGINT', async () => {
  await createStubCommand('flyctl', "trap 'exit 0' INT\nwhile true; do sleep 0.05; done");

  expect(
    runFlyctl(['deploy'], { stallInterrupt: { afterMs: 100, graceMs: 2000 } }),
  ).rejects.toMatchObject({ exitCode: 0, stalledAfterMs: 100 });
});

test('it kills a stalled flyctl call that ignores SIGINT once the grace runs out', async () => {
  await createStubCommand('flyctl', "trap '' INT\nwhile true; do sleep 0.05; done");

  expect(
    runFlyctl(['deploy'], { stallInterrupt: { afterMs: 100, graceMs: 100 } }),
  ).rejects.toMatchObject({ signal: 'SIGKILL', stalledAfterMs: 100 });
});

test('it kills a flyctl call that ignores SIGINT once the grace runs out', async () => {
  await createStubCommand('flyctl', "trap '' INT\nwhile true; do sleep 0.05; done");

  expect(
    runFlyctl(['deploy'], { interrupt: { afterMs: 100, graceMs: 100 } }),
  ).rejects.toMatchObject({ signal: 'SIGKILL' });
});
