import { expect, test } from 'bun:test';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { handleDisconnectMessage } from './handle-disconnect-message';

test('it removes the port from the connections set', () => {
  const channel = new MessageChannel();

  const context = createStubWorkerContext({ connections: [channel.port2] });

  handleDisconnectMessage(context, channel.port2);

  expect(context.connections.has(channel.port2)).toBeFalse();
});

test('it closes the port so it no longer delivers messages', async () => {
  const channel = new MessageChannel();

  const context = createStubWorkerContext({ connections: [channel.port2] });

  handleDisconnectMessage(context, channel.port2);

  let received = false;

  channel.port1.start();

  channel.port1.addEventListener('message', () => {
    received = true;
  });

  channel.port2.postMessage('should not arrive');

  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

  expect(received).toBeFalse();
});
