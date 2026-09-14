import { expect, onTestFinished, test } from 'bun:test';
import { connect, createServer } from 'node:net';
import { waitFor } from '@vers/test-utils';
import invariant from 'tiny-invariant';
import { startStallingProxy } from './start-stalling-proxy';

async function setupTest() {
  const echo = createServer((socket) => {
    socket.pipe(socket);
  });

  await new Promise<void>((resolve) => {
    echo.listen(0, '127.0.0.1', resolve);
  });

  const echoAddress = echo.address();

  invariant(
    echoAddress !== null && typeof echoAddress === 'object',
    'a listening server has a port',
  );

  const proxy = await startStallingProxy(`postgres://test:test@127.0.0.1:${echoAddress.port}`);

  onTestFinished(async () => {
    await proxy.stop();

    await new Promise<void>((resolve) => {
      echo.close(() => {
        resolve();
      });
    });
  });

  const proxiedURL = new URL(proxy.baseURI);

  return { host: proxiedURL.hostname, port: Number(proxiedURL.port), proxy };
}

test('it rewrites only the host and port of the upstream base uri', async () => {
  const ctx = await setupTest();

  expect(ctx.proxy.baseURI).toStartWith('postgres://test:test@127.0.0.1:');
  expect(ctx.proxy.baseURI).toEndWith(String(ctx.port));
});

test('it forwards bytes both ways while forwarding is on', async () => {
  const ctx = await setupTest();

  const received: Array<string> = [];
  const client = connect({ host: ctx.host, port: ctx.port });

  onTestFinished(() => {
    client.destroy();
  });

  client.on('data', (chunk) => {
    received.push(chunk.toString());
  });

  client.write('ping');

  await waitFor(() => {
    expect(received.join('')).toBe('ping');
  });
});

test('it withholds upstream bytes from a connection open when forwarding stops', async () => {
  const ctx = await setupTest();

  const received: Array<string> = [];
  const client = connect({ host: ctx.host, port: ctx.port });

  onTestFinished(() => {
    client.destroy();
  });

  client.on('data', (chunk) => {
    received.push(chunk.toString());
  });

  client.write('ping');

  await waitFor(() => {
    expect(received.join('')).toBe('ping');
  });

  ctx.proxy.stopForwarding();
  client.write('pong');

  // the echo answers on the loopback within a millisecond, so 200ms of silence is the withheld
  // reply, not a slow one
  await expect(
    waitFor(
      () => {
        expect(received.join('')).toBe('pingpong');
      },
      { timeoutMs: 200 },
    ),
  ).toReject();
});

test('it forwards on a connection opened after forwarding stopped', async () => {
  const ctx = await setupTest();

  const received: Array<string> = [];

  ctx.proxy.stopForwarding();

  const client = connect({ host: ctx.host, port: ctx.port });

  onTestFinished(() => {
    client.destroy();
  });

  client.on('data', (chunk) => {
    received.push(chunk.toString());
  });

  client.write('ping');

  await waitFor(() => {
    expect(received.join('')).toBe('ping');
  });
});
