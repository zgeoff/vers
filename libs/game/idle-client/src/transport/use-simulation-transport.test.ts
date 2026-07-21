import { expect, onTestFinished, test } from 'bun:test';
import { render, renderHook, waitFor } from '@testing-library/react';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import { createElement } from 'react';
import invariant from 'tiny-invariant';
import { setSimulationTransport } from '../state/set-simulation-transport';
import { useIdleStore } from '../state/use-idle-store';
import type { SimulationTransport } from '../types';
import { ClientMessageType, WorkerMessageType } from '../types';
import type { ClientMessage } from '../worker/client-to-worker-message-schema';
import type {
  ActivityCompletedMessage,
  CheckpointFlushStalledMessage,
  CheckpointStreamInvalidMessage,
  ConnectionStatusMessage,
  InitialStateMessage,
  ResyncStatusMessage,
  RewardSlotsRecordedMessage,
  SimulationUpdateMessage,
  WriterDisplacedMessage,
  WriterReadyMessage,
} from '../worker/worker-to-client-message-schema';
import { useSimulationTransport } from './use-simulation-transport';

/**
 * Stands in for a real SharedWorker: `.port` is the client-facing end, `.channel.port2` is the end
 * a test drives from to act as the worker process. Real worker behaviour (message handling,
 * simulation ticking) is covered by the runtime's own suite — this file only exercises the hook's
 * wiring.
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

function getStubSharedWorker(): StubSharedWorker {
  const worker = constructedWorkers.at(-1);

  invariant(worker, 'expected the hook to construct a StubSharedWorker');

  return worker;
}

test('it creates a transport over the SharedWorker connection', () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  expect(hook.result.current).not.toBeNull();
  expect(constructedWorkers.at(-1)).toBeInstanceOf(StubSharedWorker);

  // unmounted inside the test body: the preload's store reset fires while a mounted hook still
  // subscribes, and its effect would resurrect a transport into the freshly reset store
  hook.unmount();
});

function TransportConsumer() {
  useSimulationTransport();

  return null;
}

test('it constructs one transport for sibling consumers mounting in the same commit', () => {
  registerSharedWorkerStub();

  // sibling effects all run before any store write re-renders them, so only an imperative store
  // check keeps the second and third consumer from constructing their own transport
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

test('it returns the existing transport instead of creating a new one', () => {
  const transport: SimulationTransport = {
    post: () => {},
    subscribe: () => () => {},
  };

  setSimulationTransport(transport);

  const hook = renderHook(() => useSimulationTransport());

  expect(hook.result.current).toBe(transport);

  hook.unmount();
});

test('it creates no transport when neither SharedWorker nor Web Locks is supported', () => {
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

test('it posts client messages through the worker port', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  invariant(hook.result.current, 'transport not created');

  const worker = getStubSharedWorker();

  worker.channel.port2.start();

  const received = new Promise<MessageEvent<ClientMessage>>((resolve) => {
    worker.channel.port2.addEventListener('message', resolve, { once: true });
  });

  hook.result.current.post({ type: ClientMessageType.Initialize });

  const event = await received;

  expect(event.data).toStrictEqual({ type: ClientMessageType.Initialize });

  hook.unmount();
});

test('it updates simulation state from worker messages', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const worker = getStubSharedWorker();

  worker.channel.port2.start();

  const message: InitialStateMessage = {
    rewardSlotLedger: { activityID: null, entries: [] },
    state: { combat: { elapsed: 1000 }, failureAction: ActivityFailureAction.Retry },
    type: WorkerMessageType.InitialState,
    writerDisplacedActivityID: null,
  };

  worker.channel.port2.postMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().initialized).toBeTrue();
  });

  expect(useIdleStore.getState().combat).toStrictEqual({ elapsed: 1000 });
  expect(useIdleStore.getState().failureAction).toBe(ActivityFailureAction.Retry);

  hook.unmount();
});

test('it resets the handshake and advances the generation on a writer-ready broadcast', async () => {
  registerSharedWorkerStub();

  useIdleStore.setState({ initialized: true });

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const worker = getStubSharedWorker();

  worker.channel.port2.start();

  const message: WriterReadyMessage = {
    type: WorkerMessageType.WriterReady,
  };

  worker.channel.port2.postMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().writerGeneration).toBe(1);
  });

  expect(useIdleStore.getState().initialized).toBeFalse();

  hook.unmount();
});

test('it reports a checkpoint stream error from worker messages', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const worker = getStubSharedWorker();

  worker.channel.port2.start();

  const message: CheckpointStreamInvalidMessage = {
    activityID: 'activity_1',
    reason: 'broken-chain-link',
    traceID: 'trace_1',
    type: WorkerMessageType.CheckpointStreamInvalid,
  };

  worker.channel.port2.postMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().checkpointStreamError).toStrictEqual({
      activityID: 'activity_1',
      reason: 'broken-chain-link',
      traceID: 'trace_1',
    });
  });

  hook.unmount();
});

test('it records a flush stall report from worker messages', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const worker = getStubSharedWorker();

  worker.channel.port2.start();

  const message: CheckpointFlushStalledMessage = {
    activityID: 'activity_1',
    reason: 'network down',
    traceID: 'trace_1',
    type: WorkerMessageType.CheckpointFlushStalled,
  };

  worker.channel.port2.postMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().checkpointFlushStall).toStrictEqual({
      activityID: 'activity_1',
      reason: 'network down',
      traceID: 'trace_1',
    });
  });

  hook.unmount();
});

test('it records the completed activity from worker messages', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const worker = getStubSharedWorker();

  worker.channel.port2.start();

  const message: ActivityCompletedMessage = {
    activityID: 'activity_1',
    type: WorkerMessageType.ActivityCompleted,
  };

  worker.channel.port2.postMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().lastCompletedActivityID).toBe('activity_1');
  });

  hook.unmount();
});

test('it maps a resync status message onto the store', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const worker = getStubSharedWorker();

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

  hook.unmount();
});

test('it maps a connection status message onto the store', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const worker = getStubSharedWorker();

  worker.channel.port2.start();

  const message: ConnectionStatusMessage = {
    online: false,
    type: WorkerMessageType.ConnectionStatus,
  };

  worker.channel.port2.postMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().connectionOnline).toBeFalse();
  });

  hook.unmount();
});

test('it sends a disconnect message on pagehide', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const worker = getStubSharedWorker();

  worker.channel.port2.start();

  const received = new Promise<MessageEvent<ClientMessage>>((resolve) => {
    worker.channel.port2.addEventListener('message', resolve, { once: true });
  });

  globalThis.dispatchEvent(new Event('pagehide'));

  const event = await received;

  expect(event.data).toStrictEqual({ type: ClientMessageType.Disconnect });

  hook.unmount();
});

test('it accumulates the reward-slot ledger from worker messages', async () => {
  registerSharedWorkerStub();

  useIdleStore.setState({ checkpointStreamError: null });

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const worker = getStubSharedWorker();

  worker.channel.port2.start();

  const initialStateMessage: InitialStateMessage = {
    rewardSlotLedger: { activityID: null, entries: [] },
    state: {
      activity: createMockActivitySnapshot({ id: 'activity_1' }),
      failureAction: ActivityFailureAction.Retry,
    },
    type: WorkerMessageType.InitialState,
    writerDisplacedActivityID: null,
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

  hook.unmount();
});

test('it resets the reward-slot ledger once a new activity reports its own message', async () => {
  registerSharedWorkerStub();

  useIdleStore.setState({ checkpointStreamError: null });

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const worker = getStubSharedWorker();

  worker.channel.port2.start();

  worker.channel.port2.postMessage({
    rewardSlotLedger: { activityID: null, entries: [] },
    state: {
      activity: createMockActivitySnapshot({ id: 'activity_1' }),
      failureAction: ActivityFailureAction.Retry,
    },
    type: WorkerMessageType.InitialState,
    writerDisplacedActivityID: null,
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
  } satisfies SimulationUpdateMessage);

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

  hook.unmount();
});

test('it installs the reward-slot ledger carried by the initial state', async () => {
  registerSharedWorkerStub();

  useIdleStore.setState({ rewardSlotLedger: [], rewardSlotLedgerActivityID: null });

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const worker = getStubSharedWorker();

  worker.channel.port2.start();

  worker.channel.port2.postMessage({
    rewardSlotLedger: { activityID: 'activity_1', entries: [{ count: 2, version: 1 }] },
    state: {
      activity: createMockActivitySnapshot({ id: 'activity_1' }),
      failureAction: ActivityFailureAction.Retry,
    },
    type: WorkerMessageType.InitialState,
    writerDisplacedActivityID: null,
  } satisfies InitialStateMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 2, version: 1 }]);
  });

  expect(useIdleStore.getState().rewardSlotLedgerActivityID).toBe('activity_1');

  hook.unmount();
});

test('it maps a writer displaced message onto the store', async () => {
  registerSharedWorkerStub();

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const worker = getStubSharedWorker();

  worker.channel.port2.start();

  const message: WriterDisplacedMessage = {
    activityID: 'activity_1',
    type: WorkerMessageType.WriterDisplaced,
  };

  worker.channel.port2.postMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().writerDisplacedActivityID).toBe('activity_1');
  });

  hook.unmount();
});
