import { expect, onTestFinished, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { updateEnv, waitFor } from '@zgeoff/testing';
import { createStubBin } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { runDockerCompose } from './run-docker-compose';

test('it runs docker compose against the repo compose file with the args it gets', async () => {
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  const dockerPath = createStubBin(stubDirectory, 'docker', {
    script: '#!/bin/sh\necho "$@" > "$(dirname "$0")/args"',
  }).path;

  await runDockerCompose(['logs', '--tail=0', 'postgres']);

  const args = await readFile(join(dirname(dockerPath), 'args'), 'utf8');

  expect(args).toBe(
    `compose -f ${join(import.meta.dir, '../../../../docker-compose.yml')} logs --tail=0 postgres\n`,
  );
});

test('it ends docker compose when the process that ran it gets SIGTERM', async () => {
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);

  const dockerPath = createStubBin(stubDirectory, 'docker', {
    script: '#!/bin/sh\necho $$ > "$(dirname "$0")/pid"\nexec sleep 30',
  }).path;

  const pidPath = join(dirname(dockerPath), 'pid');

  const cli = Bun.spawn(
    [
      'bun',
      '-e',
      `import { runDockerCompose } from ${JSON.stringify(join(import.meta.dir, 'run-docker-compose.ts'))};
      await runDockerCompose(['logs', '--follow']);`,
    ],
    { env: process.env },
  );

  onTestFinished(() => {
    cli.kill('SIGKILL');
  });

  const pidText = await waitFor(() => readFile(pidPath, 'utf8'), { timeoutMs: 3000 });

  const composePID = Number(pidText);

  cli.kill('SIGTERM');

  await cli.exited;

  await waitFor(() => {
    expect(() => process.kill(composePID, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
  });
});

test('it rejects when docker compose exits with a failure', () => {
  const stubDirectory = createTempDir('stubs').path;

  updateEnv('PATH', `${stubDirectory}:${process.env['PATH'] ?? ''}`);
  createStubBin(stubDirectory, 'docker', { script: '#!/bin/sh\nexit 1' });

  expect(runDockerCompose(['ps', '--all'])).rejects.toThrowWithMessage(
    Error,
    'docker compose ps --all exited with code 1',
  );
});
