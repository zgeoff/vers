import { expect, test } from 'bun:test';
import { $ } from 'bun';
import { createStubFlyctl } from './create-stub-flyctl';

test('it puts a flyctl that runs the script first on PATH', async () => {
  await createStubFlyctl('echo "stub $@"');

  const stdout = await $`flyctl machines list`.text();

  expect(stdout).toBe('stub machines list\n');
});

test('it gives the script the exit code it asks for', async () => {
  await createStubFlyctl('exit 3');

  const result = await $`flyctl status`.nothrow().quiet();

  expect(result.exitCode).toBe(3);
});
