import { expect, onTestFinished, test } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { ActivityFailureAction } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import { setSimulationWorker } from '../state/set-simulation-worker';
import { useCheckpointStreamErrorStore } from '../state/use-checkpoint-stream-error-store';
import { useCombatStore } from '../state/use-combat-store';
import { useFailureActionStore } from '../state/use-failure-action-store';
import { useSimulationStore } from '../state/use-simulation-store';
import type { CheckpointStreamInvalidMessage, ClientMessage, InitialStateMessage } from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import { useSimulationWorker } from './use-simulation-worker';

/**
 * Stands in for a real SharedWorker: `.port` is the client-facing end, `.channel.port2` is the end
 * a test drives from to act as the worker process. Real worker behaviour (message handling,
 * simulation ticking) is covered by `create-worker-runtime.test.ts` — this file only exercises the
 * hook's own wiring.
 */
class FakeSharedWorker {
  channel = new MessageChannel();

  port = this.channel.port1;
}

function registerSharedWorkerStub() {
  const originalSharedWorker = globalThis.SharedWorker;

  Reflect.set(globalThis, 'SharedWorker', FakeSharedWorker);

  onTestFinished(() => {
    Reflect.set(globalThis, 'SharedWorker', originalSharedWorker);
  });
}

test('it initializes the worker connection', () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationWorker());

  hook.rerender();

  expect(hook.result.current).toBeInstanceOf(FakeSharedWorker);

  hook.unmount();
});

test('it returns an existing worker instead of creating a new one', () => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- FakeSharedWorker stands in for a real SharedWorker; the hook only ever touches its `.port`
  const worker = new FakeSharedWorker() as unknown as SharedWorker;

  setSimulationWorker(worker);

  const hook = renderHook(() => useSimulationWorker());

  expect(hook.result.current).toBe(worker);
});

test('it creates no worker when SharedWorker is unsupported', () => {
  useSimulationStore.setState({ worker: null });

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

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the hook was stubbed to construct a FakeSharedWorker, so its return value has that shape at runtime
  const worker = hook.result.current as unknown as FakeSharedWorker;

  worker.channel.port2.start();

  const message: InitialStateMessage = {
    state: { combat: { elapsed: 1000 }, failureAction: ActivityFailureAction.Retry },
    type: WorkerMessageType.InitialState,
  };

  worker.channel.port2.postMessage(message);

  await waitFor(() => {
    expect(useSimulationStore.getState().initialized).toBeTrue();
  });

  expect(useCombatStore.getState().combat).toStrictEqual({ elapsed: 1000 });
  expect(useFailureActionStore.getState().failureAction).toBe(ActivityFailureAction.Retry);
});

test('it reports a checkpoint stream error from worker messages', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationWorker());

  hook.rerender();

  invariant(hook.result.current, 'Worker not initialized');

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the hook was stubbed to construct a FakeSharedWorker, so its return value has that shape at runtime
  const worker = hook.result.current as unknown as FakeSharedWorker;

  worker.channel.port2.start();

  const message: CheckpointStreamInvalidMessage = {
    activityID: 'activity_1',
    reason: 'broken-chain-link',
    type: WorkerMessageType.CheckpointStreamInvalid,
  };

  worker.channel.port2.postMessage(message);

  await waitFor(() => {
    expect(useCheckpointStreamErrorStore.getState().checkpointStreamError).toStrictEqual({
      activityID: 'activity_1',
      reason: 'broken-chain-link',
    });
  });
});

test('it sends a disconnect message on pagehide', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationWorker());

  hook.rerender();

  invariant(hook.result.current, 'Worker not initialized');

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the hook was stubbed to construct a FakeSharedWorker, so its return value has that shape at runtime
  const worker = hook.result.current as unknown as FakeSharedWorker;

  worker.channel.port2.start();

  const received = new Promise<MessageEvent<ClientMessage>>((resolve) => {
    worker.channel.port2.addEventListener('message', resolve, { once: true });
  });

  globalThis.dispatchEvent(new Event('pagehide'));

  const event = await received;

  expect(event.data).toStrictEqual({ type: ClientMessageType.Disconnect });
});
