import { expect, onTestFinished, test } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import invariant from 'tiny-invariant';
import { setSimulationWorker } from '../state/set-simulation-worker';
import { useIdleStore } from '../state/use-idle-store';
import type {
  CheckpointStreamInvalidMessage,
  ClientMessage,
  InitialStateMessage,
  RewardSlotsRecordedMessage,
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

test('it accumulates the reward-slot ledger from worker messages', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationWorker());

  hook.rerender();

  invariant(hook.result.current, 'Worker not initialized');

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the hook was stubbed to construct a StubSharedWorker, so its return value has that shape at runtime
  const worker = hook.result.current as unknown as StubSharedWorker;

  worker.channel.port2.start();

  const initialStateMessage: InitialStateMessage = {
    state: {
      activity: createMockActivitySnapshot({ id: 'activity_1' }),
      failureAction: ActivityFailureAction.Retry,
    },
    type: WorkerMessageType.InitialState,
  };

  worker.channel.port2.postMessage(initialStateMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().activity?.id).toBe('activity_1');
  });

  const firstMessage: RewardSlotsRecordedMessage = {
    activityID: 'activity_1',
    rewardSlotCount: 2,
    type: WorkerMessageType.RewardSlotsRecorded,
    version: 1,
  };

  worker.channel.port2.postMessage(firstMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 2, version: 1 }]);
  });

  const secondMessage: RewardSlotsRecordedMessage = {
    activityID: 'activity_1',
    rewardSlotCount: 3,
    type: WorkerMessageType.RewardSlotsRecorded,
    version: 2,
  };

  worker.channel.port2.postMessage(secondMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([
      { count: 2, version: 1 },
      { count: 3, version: 2 },
    ]);
  });
});

test('it resets the reward-slot ledger once a new activity reports its own message', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationWorker());

  hook.rerender();

  invariant(hook.result.current, 'Worker not initialized');

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the hook was stubbed to construct a StubSharedWorker, so its return value has that shape at runtime
  const worker = hook.result.current as unknown as StubSharedWorker;

  worker.channel.port2.start();

  worker.channel.port2.postMessage({
    state: {
      activity: createMockActivitySnapshot({ id: 'activity_1' }),
      failureAction: ActivityFailureAction.Retry,
    },
    type: WorkerMessageType.InitialState,
  } satisfies InitialStateMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().activity?.id).toBe('activity_1');
  });

  worker.channel.port2.postMessage({
    activityID: 'activity_1',
    rewardSlotCount: 2,
    type: WorkerMessageType.RewardSlotsRecorded,
    version: 1,
  } satisfies RewardSlotsRecordedMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 2, version: 1 }]);
  });

  worker.channel.port2.postMessage({
    state: {
      activity: createMockActivitySnapshot({ id: 'activity_2' }),
      failureAction: ActivityFailureAction.Retry,
    },
    type: WorkerMessageType.SimulationUpdate,
  });

  await waitFor(() => {
    expect(useIdleStore.getState().activity?.id).toBe('activity_2');
  });

  worker.channel.port2.postMessage({
    activityID: 'activity_2',
    rewardSlotCount: 5,
    type: WorkerMessageType.RewardSlotsRecorded,
    version: 1,
  } satisfies RewardSlotsRecordedMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 5, version: 1 }]);
  });
});
