import { expect, onTestFinished, test } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import { http, passthrough, ws } from 'msw';
import { server } from '../mocks/node';
import { startStubDevTools } from '../test-utils/start-stub-devtools';
import { startWorkerCapture } from './start-worker-capture';

function setupTest() {
  const devtools = startStubDevTools();
  const lines: Array<string> = [];

  server.use(
    http.get(`http://${devtools.endpoint}/json`, () => passthrough()),
    ws
      .link(`ws://${devtools.endpoint}/devtools/page/*`)
      .addEventListener('connection', (connection) => {
        connection.server.connect();
      }),
  );

  const startCapture = () => {
    const stop = startWorkerCapture({
      endpoint: devtools.endpoint,
      pathFilter: '/api/rpc/',
      print: (line) => {
        lines.push(line);
      },
    });

    onTestFinished(stop);
  };

  return { devtools, lines, startCapture };
}

test('it resumes a shared worker that restarts while the capture is attached', async () => {
  const ctx = setupTest();

  ctx.devtools.openTarget({ id: 'WORKER1', type: 'shared_worker' });
  ctx.startCapture();

  await waitFor(() => {
    expect(ctx.lines).toContain('attached worker WORKER1');
  });

  ctx.devtools.restartTarget('WORKER1');

  await waitFor(() => {
    expect(ctx.devtools.isTargetPaused('WORKER1')).toBeFalse();
  });
});

test('it logs a failed resume of a shared worker that restarts', async () => {
  const ctx = setupTest();

  ctx.devtools.openTarget({
    id: 'WORKER1',
    refusedMethods: ['Runtime.runIfWaitingForDebugger'],
    type: 'shared_worker',
  });

  ctx.startCapture();

  await waitFor(() => {
    expect(ctx.lines).toContain('attached worker WORKER1');
  });

  ctx.devtools.restartTarget('WORKER1');

  await waitFor(() => {
    expect(ctx.lines).toContain(
      'capture WORKER1: Runtime.runIfWaitingForDebugger: the target refused Runtime.runIfWaitingForDebugger',
    );
  });
});
