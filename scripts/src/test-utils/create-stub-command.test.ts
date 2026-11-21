import { expect, test } from 'bun:test';
import { $ } from 'bun';
import { createStubCommand } from './create-stub-command';

test('it puts a command of the given name that runs the script first on PATH', async () => {
  createStubCommand('flyctl', 'echo "stub $@"');

  const stdout = await $`flyctl machines list`.text();

  expect(stdout).toBe('stub machines list\n');
});

test('it gives the script the exit code it asks for', async () => {
  createStubCommand('docker', 'exit 3');

  const result = await $`docker compose ps`.nothrow().quiet();

  expect(result.exitCode).toBe(3);
});
