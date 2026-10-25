import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { waitFor } from '@vers/test-utils';
import { createStubChrome } from '../test-utils/create-stub-chrome';
import { withChrome } from './with-chrome';

test('it kills a Chrome whose launch never opens a debug port', async () => {
  const chromePath = await createStubChrome('echo $$ > "$(dirname "$0")/pid"\nexec sleep 30');

  const launch = withChrome(
    {
      chromePath,
      connectionPollInterval: 20,
      maxConnectionRetries: 2,
      userDataDir: dirname(chromePath),
    },
    (port) => Promise.resolve(port),
  );

  expect(launch).rejects.toThrow();

  const pidText = await readFile(join(dirname(chromePath), 'pid'), 'utf8');

  const pid = Number(pidText);

  await waitFor(() => {
    expect(() => process.kill(pid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
  });
});

test('it kills Chrome and exits with 130 when the process gets SIGINT', async () => {
  const chromePath = await createStubChrome('echo $$ > "$(dirname "$0")/pid"\nexec sleep 30');

  const pidPath = join(dirname(chromePath), 'pid');

  const cli = Bun.spawn([
    'bun',
    '-e',
    `import { withChrome } from ${JSON.stringify(join(import.meta.dir, 'with-chrome.ts'))};
      await withChrome({ chromePath: ${JSON.stringify(chromePath)}, maxConnectionRetries: 1000, userDataDir: ${JSON.stringify(dirname(chromePath))} }, (port) => Promise.resolve(port));`,
  ]);

  const pidText = await waitFor(() => readFile(pidPath, 'utf8'), { timeoutMs: 3000 });

  const pid = Number(pidText);

  cli.kill('SIGINT');

  const exitCode = await cli.exited;

  expect(exitCode).toBe(130);

  await waitFor(() => {
    expect(() => process.kill(pid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
  });
});
