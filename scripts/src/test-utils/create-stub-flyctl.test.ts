import { expect, test } from 'bun:test';
import { execa } from 'execa';
import { createStubFlyctl } from './create-stub-flyctl';

test('it puts a flyctl that runs the script first on PATH', async () => {
  await createStubFlyctl('echo "stub $@"');

  const result = await execa('flyctl', ['machines', 'list']);

  expect(result.stdout).toBe('stub machines list');
});

test('it gives the script the exit code it asks for', async () => {
  await createStubFlyctl('exit 3');

  const result = await execa('flyctl', ['status'], { reject: false });

  expect(result.exitCode).toBe(3);
});
