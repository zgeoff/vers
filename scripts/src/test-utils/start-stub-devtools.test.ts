import { expect, onTestFinished, test } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import { http, passthrough, ws } from 'msw';
import { server } from '../mocks/node';
import { createCDPClient } from '../qa/create-cdp-client';
import { readDevToolsTargets } from '../qa/read-devtools-targets';
import { startStubDevTools } from './start-stub-devtools';

function setupTest() {
  const devtools = startStubDevTools();

  server.use(
    http.get(`http://${devtools.endpoint}/json`, () => passthrough()),
    ws
      .link(`ws://${devtools.endpoint}/devtools/page/*`)
      .addEventListener('connection', (connection) => {
        connection.server.connect();
      }),
  );

  return { devtools };
}

test('it lists each open target with its socket URL', async () => {
  const ctx = setupTest();

  ctx.devtools.openTarget({ id: 'PAGE1', type: 'page' });

  const targets = await readDevToolsTargets(ctx.devtools.endpoint);

  expect(targets).toStrictEqual([
    {
      id: 'PAGE1',
      title: '',
      type: 'page',
      url: 'https://example.test/',
      webSocketDebuggerUrl: `ws://${ctx.devtools.endpoint}/devtools/page/PAGE1`,
    },
  ]);
});

test('it fails a fetch while the session that set offline emulation stays open', async () => {
  const ctx = setupTest();

  ctx.devtools.openTarget({ id: 'WORKER1', type: 'shared_worker' });

  const session = await createCDPClient(`ws://${ctx.devtools.endpoint}/devtools/page/WORKER1`);

  onTestFinished(() => {
    session.close();
  });

  await session.send('Network.emulateNetworkConditions', { offline: true });

  expect(ctx.devtools.getFetchOutcome('WORKER1')).toBe('failed');
});

test('it drops offline emulation when the session that set it closes', async () => {
  const ctx = setupTest();

  ctx.devtools.openTarget({ id: 'PAGE1', type: 'page' });

  const session = await createCDPClient(`ws://${ctx.devtools.endpoint}/devtools/page/PAGE1`);

  await session.send('Network.emulateNetworkConditions', { offline: true });

  session.close();

  await session.closed;

  await waitFor(() => {
    expect(ctx.devtools.getFetchOutcome('PAGE1')).toBe('ok');
  });
});

test('it refuses a method it does not model', async () => {
  const ctx = setupTest();

  ctx.devtools.openTarget({ id: 'PAGE1', type: 'page' });

  const session = await createCDPClient(`ws://${ctx.devtools.endpoint}/devtools/page/PAGE1`);

  onTestFinished(() => {
    session.close();
  });

  expect(session.send('Page.reload')).rejects.toThrow("Page.reload: 'Page.reload' wasn't found");
});
