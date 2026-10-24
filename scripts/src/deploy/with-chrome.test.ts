import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { waitFor } from '@vers/test-utils';
import { createStubChrome } from '../test-utils/create-stub-chrome';
import { withChrome } from './with-chrome';

test('it kills a Chrome whose launch never opens a debug port', async () => {
  const chromePath = await createStubChrome('echo $$ > "$(dirname "$0")/pid"\nexec sleep 30');

  const launch = withChrome(
    { chromePath, connectionPollInterval: 20, maxConnectionRetries: 2 },
    (port) => Promise.resolve(port),
  );

  expect(launch).rejects.toThrow();

  const pidText = await readFile(join(dirname(chromePath), 'pid'), 'utf8');

  const pid = Number(pidText);

  await waitFor(() => {
    expect(() => process.kill(pid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
  });
});
