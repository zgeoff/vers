import { expect, onTestFinished, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { waitFor } from '@vers/test-utils';
import { startStubDevTools } from '../test-utils/start-stub-devtools';
import { createOfflineHold } from './create-offline-hold';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'offline-hold-'));

  onTestFinished(() => rm(directory, { force: true, recursive: true }));

  return { devtools: startStubDevTools(), directory };
}

test('it stops the hold when its state file cannot be written', async () => {
  const ctx = await setupTest();

  const stateFile = join(ctx.directory, 'PAGE1.json');

  ctx.devtools.openTarget({ id: 'PAGE1', type: 'page' });

  await mkdir(stateFile);

  const paths = {
    directory: ctx.directory,
    lockFile: join(ctx.directory, 'PAGE1.lock'),
    stateFile,
  };

  expect(createOfflineHold(ctx.devtools.endpoint, 'PAGE1', paths)).rejects.toThrow(
    `EISDIR: illegal operation on a directory, open '${stateFile}'`,
  );

  await waitFor(() => {
    expect(ctx.devtools.getFetchOutcome('PAGE1')).toBe('ok');
  });
});
