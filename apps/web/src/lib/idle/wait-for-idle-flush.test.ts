import { expect, test } from 'bun:test';
import type { ClientMessage } from '@vers/idle-client';
import { ClientMessageType, WorkerMessageType } from '@vers/idle-client';
import { waitForIdleFlush } from './wait-for-idle-flush';

test('it resolves when the matching flush-completed ack arrives', async () => {
  const channel = new MessageChannel();

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a MessageChannel port pair stands in for a SharedWorker's port, the only member the function under test reads
  const worker = { port: channel.port1 } as unknown as SharedWorker;

  channel.port2.start();

  channel.port2.addEventListener('message', (event: MessageEvent<ClientMessage>) => {
    const message = event.data;

    if (message.type !== ClientMessageType.RequestFlush) {
      return;
    }

    channel.port2.postMessage({
      activityID: message.activityID,
      requestID: message.requestID,
      type: WorkerMessageType.FlushCompleted,
    });
  });

  await waitForIdleFlush(worker, 'activity_1');
});

test('it ignores an ack with a different request id until the timeout resolves it', async () => {
  const channel = new MessageChannel();

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a MessageChannel port pair stands in for a SharedWorker's port, the only member the function under test reads
  const worker = { port: channel.port1 } as unknown as SharedWorker;

  channel.port2.start();

  channel.port2.addEventListener('message', (event: MessageEvent<ClientMessage>) => {
    const message = event.data;

    if (message.type !== ClientMessageType.RequestFlush) {
      return;
    }

    channel.port2.postMessage({
      activityID: message.activityID,
      requestID: 'a-different-request',
      type: WorkerMessageType.FlushCompleted,
    });
  });

  const started = Date.now();

  await waitForIdleFlush(worker, 'activity_1', 20);

  expect(Date.now() - started).toBeGreaterThanOrEqual(20);
});

test('it resolves after the timeout when no ack arrives', async () => {
  const channel = new MessageChannel();

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a MessageChannel port pair stands in for a SharedWorker's port, the only member the function under test reads
  const worker = { port: channel.port1 } as unknown as SharedWorker;
  const started = Date.now();

  await waitForIdleFlush(worker, 'activity_1', 20);

  expect(Date.now() - started).toBeGreaterThanOrEqual(20);
});
