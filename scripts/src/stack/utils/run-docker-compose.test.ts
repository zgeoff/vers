import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createStubCommand } from '../../test-utils/create-stub-command';
import { runDockerCompose } from './run-docker-compose';

test('it runs docker compose against the repo compose file with the args it gets', async () => {
  const dockerPath = await createStubCommand('docker', 'echo "$@" > "$(dirname "$0")/args"');

  await runDockerCompose(['logs', '--tail=0', 'postgres']);

  const args = await readFile(join(dirname(dockerPath), 'args'), 'utf8');

  expect(args).toBe(
    `compose -f ${join(import.meta.dir, '../../../../docker-compose.yml')} logs --tail=0 postgres\n`,
  );
});

test('it rejects when docker compose exits with a failure', async () => {
  await createStubCommand('docker', 'exit 1');

  expect(runDockerCompose(['ps', '--all'])).rejects.toThrowWithMessage(
    Error,
    'docker compose ps --all exited with code 1',
  );
});
