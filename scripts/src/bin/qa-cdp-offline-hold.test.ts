import { expect, onTestFinished, test } from 'bun:test';
import { join } from 'node:path';
import { waitFor } from '@vers/test-utils';
import { startStubDevTools } from '../test-utils/start-stub-devtools';

function setupTest() {
  const devtools = startStubDevTools();
  const bin = join(import.meta.dir, 'qa-cdp-offline-hold.ts');

  const startHold = (targetID: string) => {
    const hold = Bun.spawn([process.execPath, bin, '--endpoint', devtools.endpoint, targetID], {
      stdin: 'pipe',
      stdout: 'ignore',
    });

    onTestFinished(() => {
      hold.kill('SIGKILL');
    });

    return hold;
  };

  return { devtools, startHold };
}

test('it ends the hold when stdin closes before the parent confirms the save', async () => {
  const ctx = setupTest();

  ctx.devtools.openTarget({ id: 'PAGE1', type: 'page' });

  const hold = ctx.startHold('PAGE1');

  await waitFor(() => {
    expect(ctx.devtools.getFetchOutcome('PAGE1')).toBe('failed');
  });

  await hold.stdin.end();

  const exitCode = await hold.exited;

  expect(exitCode).toBe(0);

  await waitFor(() => {
    expect(ctx.devtools.getFetchOutcome('PAGE1')).toBe('ok');
  });
});
