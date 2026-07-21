import { expect, onTestFinished, test } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import { CLIENT_TO_WORKER_CHANNEL, WORKER_TO_CLIENT_CHANNEL } from '../transport/constants';
import type { ClientMessage, WorkerMessage } from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import { createBroadcastConnection } from './create-broadcast-connection';

test('it fans posts out on the worker-to-client channel', async () => {
  const connection = createBroadcastConnection();

  const tabSide = new BroadcastChannel(WORKER_TO_CLIENT_CHANNEL);

  onTestFinished(() => {
    connection.close();
    tabSide.close();
  });

  const received: Array<WorkerMessage> = [];

  tabSide.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    received.push(event.data);
  });

  connection.postMessage({ type: WorkerMessageType.WriterReady });

  await waitFor(() => {
    expect(received).toStrictEqual([{ type: WorkerMessageType.WriterReady }]);
  });
});

test('it delivers client-to-worker traffic to the message listener', async () => {
  const connection = createBroadcastConnection();

  const tabSide = new BroadcastChannel(CLIENT_TO_WORKER_CHANNEL);

  onTestFinished(() => {
    connection.close();
    tabSide.close();
  });

  const received: Array<ClientMessage> = [];

  connection.addEventListener('message', (event) => {
    received.push(event.data);
  });

  tabSide.postMessage({ type: ClientMessageType.Initialize });

  await waitFor(() => {
    expect(received).toStrictEqual([{ type: ClientMessageType.Initialize }]);
  });
});
