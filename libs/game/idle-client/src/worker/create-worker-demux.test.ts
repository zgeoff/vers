import { expect, mock, onTestFinished, test } from 'bun:test';
import { onMessagePortClose } from '@orpc/client/message-port';
import { ActivityFailureAction } from '@vers/idle-core';
import { waitFor } from '@vers/test-utils';
import { RPC_CLIENT_TO_WORKER_CHANNEL } from '../transport/constants';
import { createBroadcastPort } from '../transport/create-broadcast-port';
import { createWorkerClient } from '../transport/create-worker-client';
import { createWorkerDemux } from './create-worker-demux';
import { createWorkerRuntime } from './create-worker-runtime';

test('it upgrades an unseen tab id into its own virtual port and answers its calls', async () => {
  using runtime = createWorkerRuntime();

  const demux = createWorkerDemux({ upgrade: runtime.upgrade });

  onTestFinished(() => {
    demux.stop();
  });

  const client = createWorkerClient(createBroadcastPort());

  const result = await client.initialize({});

  expect(result.writerDisplacedActivityID).toBeNull();
});

test('it keeps two tabs isolated under interleaved concurrent calls', async () => {
  using runtime = createWorkerRuntime();

  const demux = createWorkerDemux({ upgrade: runtime.upgrade });

  onTestFinished(() => {
    demux.stop();
  });

  const tabA = createWorkerClient(createBroadcastPort());
  const tabB = createWorkerClient(createBroadcastPort());

  const [resultA, resultB] = await Promise.all([
    tabA.setFailureAction({ avatarID: 'avatar_a', failureAction: ActivityFailureAction.Retry }),
    tabB.setFailureAction({ avatarID: 'avatar_b', failureAction: ActivityFailureAction.Abort }),
  ]);

  expect(resultA).toStrictEqual({ failureAction: ActivityFailureAction.Retry });
  expect(resultB).toStrictEqual({ failureAction: ActivityFailureAction.Abort });
});

test('it evicts an idle tab and re-upgrades a re-appearing tab id', async () => {
  using runtime = createWorkerRuntime();

  const upgrade = mock(runtime.upgrade);
  const demux = createWorkerDemux({ evictAfterMs: 20, upgrade });

  onTestFinished(() => {
    demux.stop();
  });

  const first = createWorkerClient(createBroadcastPort({ tabID: 'tab-x' }));

  await first.initialize({});

  expect(upgrade).toHaveBeenCalledTimes(1);

  // outlast the eviction window's real-time sweep interval
  await new Promise((resolve) => {
    setTimeout(resolve, 60);
  });

  const second = createWorkerClient(createBroadcastPort({ tabID: 'tab-x' }));

  void second.initialize({});

  await waitFor(() => {
    expect(upgrade).toHaveBeenCalledTimes(2);
  });
});

test('it fires the virtual port close listeners when the sweep evicts an idle tab', async () => {
  const closes: Array<string> = [];

  const demux = createWorkerDemux({
    evictAfterMs: 20,
    upgrade: (port) => {
      onMessagePortClose(port, () => {
        closes.push('close');
      });
    },
  });

  onTestFinished(() => {
    demux.stop();
  });

  const channel = new BroadcastChannel(RPC_CLIENT_TO_WORKER_CHANNEL);

  onTestFinished(() => {
    channel.close();
  });

  channel.postMessage({ data: 'ping', tabID: 'tab-idle' });

  await waitFor(() => {
    expect(closes).toStrictEqual(['close']);
  });
});
