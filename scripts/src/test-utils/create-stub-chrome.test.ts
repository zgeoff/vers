import { expect, test } from 'bun:test';
import { $ } from 'bun';
import { createStubChrome } from './create-stub-chrome';

test('it creates an executable that runs the script with the flags it gets', async () => {
  const chromePath = await createStubChrome('echo "stub $@"');
  const stdout = await $`${chromePath} --headless=new --remote-debugging-port=0`.text();

  expect(stdout).toBe('stub --headless=new --remote-debugging-port=0\n');
});
