import { expect, onTestFinished, test } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { ActivityFailureAction } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import { setSimulationWorker } from '../state/set-simulation-worker';
import { useIdleStore } from '../state/use-idle-store';
import type {
  CheckpointStreamInvalidMessage,
  ClientMessage,
  ConnectionStatusMessage,
  InitialStateMessage,
  ResyncStatusMessage,
} from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import { useSimulationWorker } from './use-simulation-worker';

/**
 * Stands in for a real SharedWorker: `.port` is the client-facing end, `.channel.port2` is the end
 * a test drives from to act as the worker process. Real worker behaviour (message handling,
 * simulation ticking) is covered by `create-worker-runtime.test.ts` — this file only exercises the
 * hook's own wiring.
 */
class StubSharedWorker {
  channel = new MessageChannel();

  port = this.channel.port1;
}

function registerSharedWorkerStub() {
  const originalSharedWorker = globalThis.SharedWorker;

  Reflect.set(globalThis, 'SharedWorker', StubSharedWorker);

  onTestFinished(() => {
    Reflect.set(globalThis, 'SharedWorker', originalSharedWorker);
  });
}

test('it initializes the worker connection', () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationWorker());

  hook.rerender();

  expect(hook.result.current).toBeInstanceOf(StubSharedWorker);

  hook.unmount();
});

test('it returns an existing worker instead of creating a new one', () => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- StubSharedWorker stands in for a real SharedWorker; the hook only ever touches its `.port`
  const worker = new StubSharedWorker() as unknown as SharedWorker;

  setSimulationWorker(worker);

  const hook = renderHook(() => useSimulationWorker());

  expect(hook.result.current).toBe(worker);
});

test('it creates no worker when SharedWorker is unsupported', () => {
  useIdleStore.setState({ worker: null });

  const originalSharedWorker = globalThis.SharedWorker;

  Reflect.set(globalThis, 'SharedWorker', undefined);

  onTestFinished(() => {
    Reflect.set(globalThis, 'SharedWorker', originalSharedWorker);
  });

  const hook = renderHook(() => useSimulationWorker());

  hook.rerender();

  expect(hook.result.current).toBeNull();

  hook.unmount();
});

test('it updates simulation state from worker messages', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationWorker());

  hook.rerender();

  invariant(hook.result.current, 'Worker not initialized');

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the hook was stubbed to construct a StubSharedWorker, so its return value has that shape at runtime
  const worker = hook.result.current as unknown as StubSharedWorker;

  worker.channel.port2.start();

  const message: InitialStateMessage = {
    state: { combat: { elapsed: 1000 }, failureAction: ActivityFailureAction.Retry },
    type: WorkerMessageType.InitialState,
  };

  worker.channel.port2.postMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().initialized).toBeTrue();
  });

  expect(useIdleStore.getState().combat).toStrictEqual({ elapsed: 1000 });
  expect(useIdleStore.getState().failureAction).toBe(ActivityFailureAction.Retry);
});

test('it reports a checkpoint stream error from worker messages', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationWorker());

  hook.rerender();

  invariant(hook.result.current, 'Worker not initialized');

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the hook was stubbed to construct a StubSharedWorker, so its return value has that shape at runtime
  const worker = hook.result.current as unknown as StubSharedWorker;

  worker.channel.port2.start();

  const message: CheckpointStreamInvalidMessage = {
    activityID: 'activity_1',
    reason: 'broken-chain-link',
    type: WorkerMessageType.CheckpointStreamInvalid,
  };

  worker.channel.port2.postMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().checkpointStreamError).toStrictEqual({
      activityID: 'activity_1',
      reason: 'broken-chain-link',
    });
  });
});

test('it maps a resync status message onto the store', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationWorker());

  hook.rerender();

  invariant(hook.result.current, 'Worker not initialized');

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the hook was stubbed to construct a StubSharedWorker, so its return value has that shape at runtime
  const worker = hook.result.current as unknown as StubSharedWorker;

  worker.channel.port2.start();

  const message: ResyncStatusMessage = {
    status: { attempts: 2, kind: 'fast-forwarding', levelUps: 1 },
    type: WorkerMessageType.ResyncStatus,
  };

  worker.channel.port2.postMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().resyncStatus).toStrictEqual({
      attempts: 2,
      kind: 'fast-forwarding',
      levelUps: 1,
    });
  });
});

test('it maps a connection status message onto the store', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationWorker());

  hook.rerender();

  invariant(hook.result.current, 'Worker not initialized');

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the hook was stubbed to construct a StubSharedWorker, so its return value has that shape at runtime
  const worker = hook.result.current as unknown as StubSharedWorker;

  worker.channel.port2.start();

  const message: ConnectionStatusMessage = {
    online: false,
    type: WorkerMessageType.ConnectionStatus,
  };

  worker.channel.port2.postMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().connectionOnline).toBeFalse();
  });
});

test('it sends a disconnect message on pagehide', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationWorker());

  hook.rerender();

  invariant(hook.result.current, 'Worker not initialized');

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the hook was stubbed to construct a StubSharedWorker, so its return value has that shape at runtime
  const worker = hook.result.current as unknown as StubSharedWorker;

  worker.channel.port2.start();

  const received = new Promise<MessageEvent<ClientMessage>>((resolve) => {
    worker.channel.port2.addEventListener('message', resolve, { once: true });
  });

  globalThis.dispatchEvent(new Event('pagehide'));

  const event = await received;

  expect(event.data).toStrictEqual({ type: ClientMessageType.Disconnect });
});
