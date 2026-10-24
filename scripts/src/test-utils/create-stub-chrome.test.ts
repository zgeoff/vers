import { expect, test } from 'bun:test';
import { execa } from 'execa';
import { createStubChrome } from './create-stub-chrome';

test('it creates an executable that runs the script with the flags it gets', async () => {
  const chromePath = await createStubChrome('echo "stub $@"');
  const result = await execa(chromePath, ['--headless=new', '--remote-debugging-port=0']);

  expect(result.stdout).toBe('stub --headless=new --remote-debugging-port=0');
});
