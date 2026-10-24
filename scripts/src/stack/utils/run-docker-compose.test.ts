import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createStubDocker } from '../../test-utils/create-stub-docker';
import { runDockerCompose } from './run-docker-compose';

test('it runs docker compose against the repo compose file with the args it gets', async () => {
  const dockerPath = await createStubDocker('echo "$@" > "$(dirname "$0")/args"');

  await runDockerCompose(['logs', '--tail=0', 'postgres']);

  const args = await readFile(join(dirname(dockerPath), 'args'), 'utf8');

  expect(args).toBe(
    `compose -f ${join(import.meta.dir, '../../../../docker-compose.yml')} logs --tail=0 postgres\n`,
  );
});

test('it rejects when docker compose exits with a failure', async () => {
  await createStubDocker('exit 1');

  expect(runDockerCompose(['ps', '--all'])).rejects.toThrowWithMessage(
    Error,
    'docker compose ps --all exited with code 1',
  );
});
