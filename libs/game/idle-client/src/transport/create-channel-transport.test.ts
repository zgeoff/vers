import { expect, onTestFinished, test } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import type { ClientMessage, WorkerMessage } from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import { CLIENT_TO_WORKER_CHANNEL, WORKER_TO_CLIENT_CHANNEL } from './constants';
import { createChannelTransport } from './create-channel-transport';

test('it posts client messages on the client-to-worker channel', async () => {
  const transport = createChannelTransport({ createWorker: () => {} });

  const workerSide = new BroadcastChannel(CLIENT_TO_WORKER_CHANNEL);

  onTestFinished(() => {
    workerSide.close();
  });

  const received: Array<ClientMessage> = [];

  workerSide.addEventListener('message', (event: MessageEvent<ClientMessage>) => {
    received.push(event.data);
  });

  transport.post({ type: ClientMessageType.Initialize });

  await waitFor(() => {
    expect(received).toStrictEqual([{ type: ClientMessageType.Initialize }]);
  });
});

test('it relays writer broadcasts to subscribers until they detach', async () => {
  const transport = createChannelTransport({ createWorker: () => {} });

  const writerSide = new BroadcastChannel(WORKER_TO_CLIENT_CHANNEL);

  onTestFinished(() => {
    writerSide.close();
  });

  const received: Array<WorkerMessage> = [];

  const unsubscribe = transport.subscribe((message) => {
    received.push(message);
  });

  writerSide.postMessage({ type: WorkerMessageType.WriterReady });

  await waitFor(() => {
    expect(received).toStrictEqual([{ type: WorkerMessageType.WriterReady }]);
  });

  unsubscribe();

  writerSide.postMessage({ type: WorkerMessageType.WriterReady });

  // deliver through the channel's async hop before asserting nothing new arrived
  await new Promise((resolve) => {
    setTimeout(resolve, 20);
  });

  expect(received).toStrictEqual([{ type: WorkerMessageType.WriterReady }]);
});
