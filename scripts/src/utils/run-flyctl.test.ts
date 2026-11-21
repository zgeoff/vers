import { expect, onTestFinished, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { updateEnv, waitFor } from '@zgeoff/testing';
import { createStubBin } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { runFlyctl } from './run-flyctl';

test('it returns what flyctl wrote to stdout', () => {
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);
  createStubBin(stubDirectory, 'flyctl', { script: '#!/bin/sh\necho "$@"' });

  expect(runFlyctl(['machines', 'list', '--json'])).resolves.toBe('machines list --json\n');
});

test('it rejects with the exit code and stderr of a flyctl call that fails', () => {
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'flyctl', {
    script: '#!/bin/sh\necho "app not found" >&2\nexit 1',
  });

  expect(runFlyctl(['status', '--app', 'vers-missing'])).rejects.toMatchObject({
    exitCode: 1,
    message: 'flyctl status --app vers-missing failed with exit code 1\napp not found',
    stderr: 'app not found\n',
  });
});

test('it ends flyctl when the process that ran it gets SIGTERM', async () => {
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  const flyctlPath = createStubBin(stubDirectory, 'flyctl', {
    script: '#!/bin/sh\necho $$ > "$(dirname "$0")/pid"\nexec sleep 30',
  }).path;

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

  // a read can land after the stub creates the file and before it writes the pid, and an empty read
  // parses as 0, which signals the test's own process group
  const flyctlPID = await waitFor(
    async () => {
      const pidText = await readFile(pidPath, 'utf8');

      const pid = Number(pidText);

      expect(pid).toBeGreaterThan(0);

      return pid;
    },
    { timeoutMs: 3000 },
  );

  cli.kill('SIGTERM');

  await cli.exited;

  await waitFor(() => {
    expect(() => process.kill(flyctlPID, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
  });
});

test('it ends a flyctl call that is still pending when the cancel signal aborts', () => {
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);
  createStubBin(stubDirectory, 'flyctl', { script: '#!/bin/sh\nexec sleep 30' });

  expect(
    runFlyctl(['machines', 'list'], { cancelSignal: AbortSignal.timeout(50) }),
  ).rejects.toMatchObject({ exitCode: 143 });
});

// the stub loops for as long as the stand-in that runs it lives, because a SIGKILL ends the
// stand-in and cannot reach the script
test('it sends SIGINT to a flyctl call that outlives its interrupt deadline', () => {
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'flyctl', {
    script:
      '#!/bin/sh\ntrap \'echo interrupted; exit 130\' INT\nwhile kill -0 "$PPID" 2>/dev/null; do sleep 0.05; done',
  });

  // a SIGINT that reaches the stub before its trap is set ends it with the shell's default exit, and
  // a loaded host can take longer than 100 ms to start the stub
  expect(
    runFlyctl(['deploy'], { interrupt: { afterMs: 1000, graceMs: 2000 } }),
  ).rejects.toMatchObject({ exitCode: 130, stdout: 'interrupted\n' });
});

test('it sends SIGINT to a flyctl call that writes nothing for its stall deadline', () => {
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'flyctl', {
    script:
      '#!/bin/sh\ntrap \'echo interrupted; exit 130\' INT\necho started\nwhile kill -0 "$PPID" 2>/dev/null; do sleep 0.05; done',
  });

  expect(
    runFlyctl(['deploy'], { stallInterrupt: { afterMs: 1000, graceMs: 2000 } }),
  ).rejects.toMatchObject({
    exitCode: 130,
    message:
      'flyctl deploy wrote nothing for 1000 ms and was interrupted, ending with exit code 130',
    stalledAfterMs: 1000,
    stdout: 'started\ninterrupted\n',
  });
});

test('it leaves a flyctl call that keeps writing past its stall deadline', () => {
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'flyctl', {
    script: '#!/bin/sh\nfor step in 1 2 3 4 5 6 7 8; do echo "#$step"; sleep 0.3; done',
  });

  expect(runFlyctl(['deploy'], { stallInterrupt: { afterMs: 1500, graceMs: 100 } })).resolves.toBe(
    '#1\n#2\n#3\n#4\n#5\n#6\n#7\n#8\n',
  );
});

test('it fails a stalled flyctl call that exits cleanly on SIGINT', () => {
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'flyctl', {
    script:
      '#!/bin/sh\ntrap \'exit 0\' INT\nwhile kill -0 "$PPID" 2>/dev/null; do sleep 0.05; done',
  });

  expect(
    runFlyctl(['deploy'], { stallInterrupt: { afterMs: 1000, graceMs: 2000 } }),
  ).rejects.toMatchObject({ exitCode: 0, stalledAfterMs: 1000 });
});

test('it kills a stalled flyctl call that ignores SIGINT once the grace runs out', () => {
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'flyctl', {
    script: '#!/bin/sh\ntrap \'\' INT\nwhile kill -0 "$PPID" 2>/dev/null; do sleep 0.05; done',
  });

  expect(
    runFlyctl(['deploy'], { stallInterrupt: { afterMs: 1000, graceMs: 100 } }),
  ).rejects.toMatchObject({ signal: 'SIGKILL', stalledAfterMs: 1000 });
});

test('it kills a flyctl call that ignores SIGINT once the grace runs out', () => {
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  createStubBin(stubDirectory, 'flyctl', {
    script: '#!/bin/sh\ntrap \'\' INT\nwhile kill -0 "$PPID" 2>/dev/null; do sleep 0.05; done',
  });

  expect(
    runFlyctl(['deploy'], { interrupt: { afterMs: 1000, graceMs: 100 } }),
  ).rejects.toMatchObject({ signal: 'SIGKILL' });
});
