import { expect, onTestFinished, test } from 'bun:test';
import { join } from 'node:path';
import { waitFor } from '@vers/test-utils';
import { startStubDevTools } from '../test-utils/start-stub-devtools';

function setupTest() {
  const devtools = startStubDevTools();
  const bin = join(import.meta.dir, 'qa-cdp-offline-hold.ts');
  const output = { stderr: '' };

  const startHold = (targetID: string) => {
    const hold = Bun.spawn([process.execPath, bin, '--endpoint', devtools.endpoint, targetID], {
      stderr: 'pipe',
      stdin: 'pipe',
      stdout: 'ignore',
    });

    onTestFinished(() => {
      hold.kill('SIGKILL');
    });

    void (async () => {
      for await (const chunk of hold.stderr.pipeThrough(new TextDecoderStream())) {
        output.stderr += chunk;
      }
    })();

    return hold;
  };

  return { devtools, output, startHold };
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

test('it resumes a held shared worker that restarts', async () => {
  const ctx = setupTest();

  ctx.devtools.openTarget({ id: 'WORKER1', type: 'shared_worker' });
  ctx.startHold('WORKER1');

  await waitFor(() => {
    expect(ctx.devtools.getFetchOutcome('WORKER1')).toBe('failed');
  });

  ctx.devtools.restartTarget('WORKER1');

  await waitFor(() => {
    expect(ctx.devtools.isTargetPaused('WORKER1')).toBeFalse();
  });
});

test('it reports a failed resume of a held shared worker that restarts', async () => {
  const ctx = setupTest();

  ctx.devtools.openTarget({
    id: 'WORKER1',
    refusedMethods: ['Runtime.runIfWaitingForDebugger'],
    type: 'shared_worker',
  });

  ctx.startHold('WORKER1');

  await waitFor(() => {
    expect(ctx.devtools.getFetchOutcome('WORKER1')).toBe('failed');
  });

  ctx.devtools.restartTarget('WORKER1');

  await waitFor(() => {
    expect(ctx.output.stderr).toBe(
      'hold WORKER1: Runtime.runIfWaitingForDebugger: the target refused Runtime.runIfWaitingForDebugger\n',
    );
  });
});
