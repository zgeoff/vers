import { expect, onTestFinished, test } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import { RPC_CLIENT_TO_WORKER_CHANNEL } from './constants';
import { createWebLocksClient } from './create-web-locks-client';

test('it envelopes an RPC call on the client-to-worker channel with a per-tab id', async () => {
  const client = createWebLocksClient({ createWorker: () => {} });

  const workerSide = new BroadcastChannel(RPC_CLIENT_TO_WORKER_CHANNEL);

  onTestFinished(() => {
    workerSide.close();
  });

  const received: Array<{ readonly data: unknown; readonly tabID: string }> = [];

  workerSide.addEventListener(
    'message',
    (event: MessageEvent<{ data: unknown; tabID: string }>) => {
      received.push(event.data);
    },
  );

  // no writer answers in this test — the call is left pending, only the outbound frame matters
  void client.initialize({});

  await waitFor(() => {
    expect(received).toHaveLength(1);
  });

  expect(typeof received[0]?.tabID).toBe('string');
});

test('it mints a distinct tab id for each client', async () => {
  const first = createWebLocksClient({ createWorker: () => {} });
  const second = createWebLocksClient({ createWorker: () => {} });

  const workerSide = new BroadcastChannel(RPC_CLIENT_TO_WORKER_CHANNEL);

  onTestFinished(() => {
    workerSide.close();
  });

  const received: Array<{ readonly tabID: string }> = [];

  workerSide.addEventListener('message', (event: MessageEvent<{ tabID: string }>) => {
    received.push(event.data);
  });

  void first.initialize({});
  void second.initialize({});

  await waitFor(() => {
    expect(received).toHaveLength(2);
  });

  expect(received[0]?.tabID).not.toBe(received[1]?.tabID);
});
