import { expect, test } from 'bun:test';
import { $ } from 'bun';
import { createStubDocker } from './create-stub-docker';

test('it puts a docker that runs the script first on PATH', async () => {
  await createStubDocker('echo "stub $@"');

  const stdout = await $`docker compose ps`.text();

  expect(stdout).toBe('stub compose ps\n');
});

test('it gives the script the exit code it asks for', async () => {
  await createStubDocker('exit 4');

  const result = await $`docker compose ps`.nothrow().quiet();

  expect(result.exitCode).toBe(4);
});
