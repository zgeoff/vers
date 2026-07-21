import { expect, onTestFinished, test } from 'bun:test';
import { render, renderHook, waitFor } from '@testing-library/react';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import { createElement } from 'react';
import invariant from 'tiny-invariant';
import { setWorkerClient } from '../state/set-worker-client';
import { useIdleStore } from '../state/use-idle-store';
import { createTestClient } from '../test-utils/create-test-client';
import { WorkerMessageType } from '../types';
import type {
  ActivityCompletedMessage,
  CheckpointStreamInvalidMessage,
  ResyncStatusMessage,
  RewardSlotsRecordedMessage,
  SimulationUpdateMessage,
  WriterDisplacedMessage,
  WriterReadyMessage,
} from '../worker/worker-to-client-message-schema';
import { WORKER_TO_CLIENT_CHANNEL } from './constants';
import { useSimulationTransport } from './use-simulation-transport';

/**
 * Stands in for a real SharedWorker: only its construction is observable here — actual worker
 * behaviour (message handling, simulation ticking) is covered by the runtime's own suite. This
 * file only exercises the hook's client-construction and broadcast-routing wiring.
 */
class StubSharedWorker extends EventTarget {
  channel = new MessageChannel();

  port = this.channel.port1;

  onerror = null;

  constructor() {
    super();

    constructedWorkers.push(this);
  }
}

const constructedWorkers: Array<StubSharedWorker> = [];

function registerSharedWorkerStub() {
  const originalSharedWorker = globalThis.SharedWorker;

  Reflect.set(globalThis, 'SharedWorker', StubSharedWorker);

  onTestFinished(() => {
    Reflect.set(globalThis, 'SharedWorker', originalSharedWorker);

    constructedWorkers.length = 0;
  });
}

/**
 * Posts a state broadcast the way both transports do, on the one channel the hook subscribes to
 * regardless of which client it constructed.
 */
function emitWorkerMessage(message: unknown) {
  const channel = new BroadcastChannel(WORKER_TO_CLIENT_CHANNEL);

  onTestFinished(() => {
    channel.close();
  });

  channel.postMessage(message);
}

test('it creates a client over the SharedWorker connection', () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  expect(hook.result.current).not.toBeNull();
  expect(constructedWorkers.at(-1)).toBeInstanceOf(StubSharedWorker);

  // unmounted inside the test body: the preload's store reset fires while a mounted hook still
  // subscribes, and its effect would resurrect a client into the freshly reset store
  hook.unmount();
});

function TransportConsumer() {
  useSimulationTransport();

  return null;
}

test('it constructs one client for sibling consumers mounting in the same commit', () => {
  registerSharedWorkerStub();

  // sibling effects all run before any store write re-renders them, so only an imperative store
  // check keeps the second and third consumer from constructing their own client
  const rendered = render(
    createElement(
      'div',
      null,
      createElement(TransportConsumer),
      createElement(TransportConsumer),
      createElement(TransportConsumer),
    ),
  );

  expect(constructedWorkers).toHaveLength(1);

  rendered.unmount();
});

test('it returns the existing client instead of creating a new one', () => {
  const client = createTestClient().client;

  setWorkerClient(client);

  const hook = renderHook(() => useSimulationTransport());

  expect(hook.result.current).toBe(client);

  hook.unmount();
});

test('it creates no client when neither SharedWorker nor Web Locks is supported', () => {
  const originalSharedWorker = globalThis.SharedWorker;

  Reflect.set(globalThis, 'SharedWorker', undefined);

  onTestFinished(() => {
    Reflect.set(globalThis, 'SharedWorker', originalSharedWorker);
  });

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  expect(hook.result.current).toBeNull();

  hook.unmount();
});

test('it updates simulation state from a broadcast', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  invariant(hook.result.current, 'client not created');

  const message: SimulationUpdateMessage = {
    state: { combat: { elapsed: 1000 }, failureAction: ActivityFailureAction.Retry },
    type: WorkerMessageType.SimulationUpdate,
  };

  emitWorkerMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().combat).toStrictEqual({ elapsed: 1000 });
  });

  expect(useIdleStore.getState().failureAction).toBe(ActivityFailureAction.Retry);

  hook.unmount();
});

test('it resets the handshake and advances the generation on a writer-ready broadcast', async () => {
  registerSharedWorkerStub();

  useIdleStore.setState({ initialized: true });

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const message: WriterReadyMessage = {
    type: WorkerMessageType.WriterReady,
  };

  emitWorkerMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().writerGeneration).toBe(1);
  });

  expect(useIdleStore.getState().initialized).toBeFalse();

  hook.unmount();
});

test('it reports a checkpoint stream error from a broadcast', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const message: CheckpointStreamInvalidMessage = {
    activityID: 'activity_1',
    type: WorkerMessageType.CheckpointStreamInvalid,
  };

  emitWorkerMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().checkpointStreamError).toStrictEqual({
      activityID: 'activity_1',
    });
  });

  hook.unmount();
});

test('it records the completed activity from a broadcast', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const message: ActivityCompletedMessage = {
    activityID: 'activity_1',
    type: WorkerMessageType.ActivityCompleted,
  };

  emitWorkerMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().lastCompletedActivityID).toBe('activity_1');
  });

  hook.unmount();
});

test('it maps a resync status broadcast onto the store', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const message: ResyncStatusMessage = {
    status: { attempts: 2, kind: 'fast-forwarding', levelUps: 1 },
    type: WorkerMessageType.ResyncStatus,
  };

  emitWorkerMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().resyncStatus).toStrictEqual({
      attempts: 2,
      kind: 'fast-forwarding',
      levelUps: 1,
    });
  });

  hook.unmount();
});

test('it accumulates the reward-slot ledger from broadcasts', async () => {
  registerSharedWorkerStub();

  useIdleStore.setState({ checkpointStreamError: null });

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  emitWorkerMessage({
    state: {
      activity: createMockActivitySnapshot({ id: 'activity_1' }),
      failureAction: ActivityFailureAction.Retry,
    },
    type: WorkerMessageType.SimulationUpdate,
  } satisfies SimulationUpdateMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().activity?.id).toBe('activity_1');
  });

  const firstMessage: RewardSlotsRecordedMessage = {
    activityID: 'activity_1',
    rewardSlotCount: 2,
    type: WorkerMessageType.RewardSlotsRecorded,
    version: 1,
  };

  emitWorkerMessage(firstMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 2, version: 1 }]);
  });

  const secondMessage: RewardSlotsRecordedMessage = {
    activityID: 'activity_1',
    rewardSlotCount: 3,
    type: WorkerMessageType.RewardSlotsRecorded,
    version: 2,
  };

  emitWorkerMessage(secondMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([
      { count: 2, version: 1 },
      { count: 3, version: 2 },
    ]);
  });

  hook.unmount();
});

test('it resets the reward-slot ledger once a new activity reports its own message', async () => {
  registerSharedWorkerStub();

  useIdleStore.setState({ checkpointStreamError: null });

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  emitWorkerMessage({
    state: {
      activity: createMockActivitySnapshot({ id: 'activity_1' }),
      failureAction: ActivityFailureAction.Retry,
    },
    type: WorkerMessageType.SimulationUpdate,
  } satisfies SimulationUpdateMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().activity?.id).toBe('activity_1');
  });

  emitWorkerMessage({
    activityID: 'activity_1',
    rewardSlotCount: 2,
    type: WorkerMessageType.RewardSlotsRecorded,
    version: 1,
  } satisfies RewardSlotsRecordedMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 2, version: 1 }]);
  });

  emitWorkerMessage({
    state: {
      activity: createMockActivitySnapshot({ id: 'activity_2' }),
      failureAction: ActivityFailureAction.Retry,
    },
    type: WorkerMessageType.SimulationUpdate,
  } satisfies SimulationUpdateMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().activity?.id).toBe('activity_2');
  });

  emitWorkerMessage({
    activityID: 'activity_2',
    rewardSlotCount: 5,
    type: WorkerMessageType.RewardSlotsRecorded,
    version: 1,
  } satisfies RewardSlotsRecordedMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 5, version: 1 }]);
  });

  hook.unmount();
});

test('it maps a writer displaced broadcast onto the store', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const message: WriterDisplacedMessage = {
    activityID: 'activity_1',
    type: WorkerMessageType.WriterDisplaced,
  };

  emitWorkerMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().writerDisplacedActivityID).toBe('activity_1');
  });

  hook.unmount();
});
