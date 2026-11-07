import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
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

test('it stops the hold when its state file cannot be saved', async () => {
  const ctx = await setupTest();

  const stateFile = join(ctx.directory, 'PAGE1.json');

  const paths = {
    directory: ctx.directory,
    lockFile: join(ctx.directory, 'PAGE1.lock'),
    logFile: join(ctx.directory, 'PAGE1.log'),
    stateFile,
  };

  ctx.devtools.openTarget({ id: 'PAGE1', type: 'page' });

  await symlink(join(ctx.directory, 'missing', 'PAGE1.json'), `${stateFile}.tmp`);

  expect(createOfflineHold(ctx.devtools.endpoint, 'PAGE1', paths)).rejects.toThrow(
    `ENOENT: no such file or directory, open '${stateFile}.tmp'`,
  );

  await waitFor(() => {
    expect(ctx.devtools.getFetchOutcome('PAGE1')).toBe('ok');
  });
});

test('it keeps the state file it had when a save fails', async () => {
  const ctx = await setupTest();

  const stateFile = join(ctx.directory, 'PAGE1.json');

  const paths = {
    directory: ctx.directory,
    lockFile: join(ctx.directory, 'PAGE1.lock'),
    logFile: join(ctx.directory, 'PAGE1.log'),
    stateFile,
  };

  ctx.devtools.openTarget({ id: 'PAGE1', type: 'page' });

  await writeFile(stateFile, '{"pid":4242,"startTime":"1"}\n');
  await symlink(join(ctx.directory, 'missing', 'PAGE1.json'), `${stateFile}.tmp`);
  await createOfflineHold(ctx.devtools.endpoint, 'PAGE1', paths).catch(() => {});

  const text = await readFile(stateFile, 'utf8');

  expect(text).toBe('{"pid":4242,"startTime":"1"}\n');
});
