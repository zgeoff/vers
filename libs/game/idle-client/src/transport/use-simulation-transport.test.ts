import { expect, onTestFinished, test } from 'bun:test';
import { render, renderHook, waitFor } from '@testing-library/react';
import { ActivityCheckpointType, ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot } from '@vers/idle-core/test-utils';
import { createElement } from 'react';
import invariant from 'tiny-invariant';
import { setWorkerClient } from '../state/set-worker-client';
import { useIdleStore } from '../state/use-idle-store';
import { createTestClient } from '../test-utils/create-test-client';
import { createMockRunOutcome } from '../test-utils/factories/create-mock-run-outcome';
import { WorkerMessageType } from '../types';
import type {
  ActivityEndedMessage,
  ActivityStartIngestedMessage,
  CheckpointStreamInvalidMessage,
  JournalFailureMessage,
  ResyncStatusMessage,
  RewardSlotsRecordedMessage,
  SaveStatusMessage,
  SimulationUpdateMessage,
  WriterDisplacedMessage,
  WriterPendingMessage,
  WriterReadyMessage,
} from '../worker/worker-to-client-message-schema';
import { WORKER_TO_CLIENT_CHANNEL } from './constants';
import { useSimulationTransport } from './use-simulation-transport';

// a browser with a SharedWorker also has Web Locks, which the transport pick now requires; the
// test runtime has neither, so both are stubbed together
function setupTest() {
  const constructedWorkers: Array<EventTarget> = [];
  const originalSharedWorker = globalThis.SharedWorker;
  const locksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');

  // the transport constructs the worker with `new`, which only a constructor answers, so a proxy
  // over one builds each stub worker in its construct trap
  const stubSharedWorker = new Proxy(EventTarget, {
    construct: () => {
      const channel = new MessageChannel();

      const worker = Object.assign(new EventTarget(), {
        channel,
        onerror: null,
        port: channel.port1,
      });

      constructedWorkers.push(worker);

      return worker;
    },
  });

  Reflect.set(globalThis, 'SharedWorker', stubSharedWorker);

  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: () => Promise.resolve() },
  });

  onTestFinished(() => {
    Reflect.set(globalThis, 'SharedWorker', originalSharedWorker);

    if (locksDescriptor === undefined) {
      Reflect.deleteProperty(navigator, 'locks');
    } else {
      Object.defineProperty(navigator, 'locks', locksDescriptor);
    }
  });

  return {
    constructedWorkers,
    emitWorkerMessage: (message: unknown) => {
      const channel = new BroadcastChannel(WORKER_TO_CLIENT_CHANNEL);

      onTestFinished(() => {
        channel.close();
      });

      channel.postMessage(message);
    },
    TransportConsumer: () => {
      useSimulationTransport();

      return null;
    },
  };
}

test('it creates a client over the SharedWorker connection', () => {
  const ctx = setupTest();
  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  expect(hook.result.current).not.toBeNull();
  expect(ctx.constructedWorkers).toHaveLength(1);

  // unmounted inside the test body: the preload's store reset fires while a mounted hook still
  // subscribes, and its effect would resurrect a client into the freshly reset store
  hook.unmount();
});

test('it constructs one client for sibling consumers mounting in the same commit', () => {
  const ctx = setupTest();

  // sibling effects all run before any store write re-renders them, so only an imperative store
  // check keeps the second and third consumer from constructing their own client
  const rendered = render(
    createElement(
      'div',
      null,
      createElement(ctx.TransportConsumer),
      createElement(ctx.TransportConsumer),
      createElement(ctx.TransportConsumer),
    ),
  );

  expect(ctx.constructedWorkers).toHaveLength(1);

  rendered.unmount();
});

test('it applies a broadcast once even with several consumers mounted', async () => {
  const ctx = setupTest();

  useIdleStore.setState({ checkpointStreamError: null });

  const rendered = render(
    createElement(
      'div',
      null,
      createElement(ctx.TransportConsumer),
      createElement(ctx.TransportConsumer),
      createElement(ctx.TransportConsumer),
    ),
  );

  ctx.emitWorkerMessage({
    state: {
      activity: createMockActivitySnapshot({ id: 'activity_1' }),
      failureAction: ActivityFailureAction.Retry,
    },
    type: WorkerMessageType.SimulationUpdate,
  } satisfies SimulationUpdateMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().activity?.id).toBe('activity_1');
  });

  ctx.emitWorkerMessage({
    activityID: 'activity_1',
    rewardSlotCount: 2,
    type: WorkerMessageType.RewardSlotsRecorded,
    version: 1,
  } satisfies RewardSlotsRecordedMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 2, version: 1 }]);
  });

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
  const ctx = setupTest();
  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  invariant(hook.result.current, 'client not created');

  const message: SimulationUpdateMessage = {
    state: { combat: { elapsed: 1000 }, failureAction: ActivityFailureAction.Retry },
    type: WorkerMessageType.SimulationUpdate,
  };

  ctx.emitWorkerMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().combat).toStrictEqual({ elapsed: 1000 });
  });

  expect(useIdleStore.getState().failureAction).toBe(ActivityFailureAction.Retry);

  hook.unmount();
});

test('it resets the handshake and advances the generation on a writer-ready broadcast', async () => {
  const ctx = setupTest();

  useIdleStore.setState({ initialized: true });

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const message: WriterReadyMessage = {
    type: WorkerMessageType.WriterReady,
  };

  ctx.emitWorkerMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().writerGeneration).toBe(1);
  });

  expect(useIdleStore.getState().initialized).toBeFalse();

  hook.unmount();
});

test('it flags writer contention on a writer-pending broadcast and clears it once the writer is ready', async () => {
  const ctx = setupTest();
  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const pending: WriterPendingMessage = { type: WorkerMessageType.WriterPending };

  ctx.emitWorkerMessage(pending);

  await waitFor(() => {
    expect(useIdleStore.getState().writerContention).toBeTrue();
  });

  const ready: WriterReadyMessage = { type: WorkerMessageType.WriterReady };

  ctx.emitWorkerMessage(ready);

  await waitFor(() => {
    expect(useIdleStore.getState().writerContention).toBeFalse();
  });

  hook.unmount();
});

test('it records a journal failure from a broadcast', async () => {
  const ctx = setupTest();
  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const message: JournalFailureMessage = {
    activityID: 'activity_1',
    kind: 'quota',
    receivedVersion: 2,
    type: WorkerMessageType.JournalFailure,
  };

  ctx.emitWorkerMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().journalFailure).toStrictEqual({
      activityID: 'activity_1',
      kind: 'quota',
      receivedVersion: 2,
    });
  });

  hook.unmount();
});

test('it folds saved and received cursors from separate broadcasts into one save status', async () => {
  const ctx = setupTest();
  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const saved: SaveStatusMessage = {
    activityID: 'activity_1',
    receivedVersion: null,
    savedVersion: 4,
    type: WorkerMessageType.SaveStatus,
  };

  const received: SaveStatusMessage = {
    activityID: 'activity_1',
    receivedVersion: 2,
    savedVersion: null,
    type: WorkerMessageType.SaveStatus,
  };

  ctx.emitWorkerMessage(saved);
  ctx.emitWorkerMessage(received);

  await waitFor(() => {
    expect(useIdleStore.getState().saveStatus).toStrictEqual({
      activityID: 'activity_1',
      receivedVersion: 2,
      savedVersion: 4,
    });
  });

  hook.unmount();
});

test('it reports a checkpoint stream error from a broadcast', async () => {
  const ctx = setupTest();
  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const message: CheckpointStreamInvalidMessage = {
    activityID: 'activity_1',
    type: WorkerMessageType.CheckpointStreamInvalid,
  };

  ctx.emitWorkerMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().checkpointStreamError).toStrictEqual({
      activityID: 'activity_1',
    });
  });

  hook.unmount();
});

test('it records the run outcome from a broadcast', async () => {
  const ctx = setupTest();
  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const message: ActivityEndedMessage = {
    outcome: createMockRunOutcome({ kind: ActivityCheckpointType.Completed }),
    type: WorkerMessageType.ActivityEnded,
  };

  ctx.emitWorkerMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().runOutcome).toStrictEqual(message.outcome);
  });

  expect(useIdleStore.getState().lastCompletedActivityID).toBe(message.outcome.activityID);

  hook.unmount();
});

test('it records the ingested activity start from a broadcast', async () => {
  const ctx = setupTest();
  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const message: ActivityStartIngestedMessage = {
    activityID: 'activity_ingested_1',
    type: WorkerMessageType.ActivityStartIngested,
  };

  ctx.emitWorkerMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().lastIngestedActivityID).toBe('activity_ingested_1');
  });

  hook.unmount();
});

test('it maps a resync status broadcast onto the store', async () => {
  const ctx = setupTest();
  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const message: ResyncStatusMessage = {
    status: { attempts: 2, kind: 'fast-forwarding', levelUps: 1 },
    type: WorkerMessageType.ResyncStatus,
  };

  ctx.emitWorkerMessage(message);

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
  const ctx = setupTest();

  useIdleStore.setState({ checkpointStreamError: null });

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  ctx.emitWorkerMessage({
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

  ctx.emitWorkerMessage(firstMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 2, version: 1 }]);
  });

  const secondMessage: RewardSlotsRecordedMessage = {
    activityID: 'activity_1',
    rewardSlotCount: 3,
    type: WorkerMessageType.RewardSlotsRecorded,
    version: 2,
  };

  ctx.emitWorkerMessage(secondMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([
      { count: 2, version: 1 },
      { count: 3, version: 2 },
    ]);
  });

  hook.unmount();
});

test('it resets the reward-slot ledger once a new activity reports its own message', async () => {
  const ctx = setupTest();

  useIdleStore.setState({ checkpointStreamError: null });

  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  ctx.emitWorkerMessage({
    state: {
      activity: createMockActivitySnapshot({ id: 'activity_1' }),
      failureAction: ActivityFailureAction.Retry,
    },
    type: WorkerMessageType.SimulationUpdate,
  } satisfies SimulationUpdateMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().activity?.id).toBe('activity_1');
  });

  ctx.emitWorkerMessage({
    activityID: 'activity_1',
    rewardSlotCount: 2,
    type: WorkerMessageType.RewardSlotsRecorded,
    version: 1,
  } satisfies RewardSlotsRecordedMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 2, version: 1 }]);
  });

  ctx.emitWorkerMessage({
    state: {
      activity: createMockActivitySnapshot({ id: 'activity_2' }),
      failureAction: ActivityFailureAction.Retry,
    },
    type: WorkerMessageType.SimulationUpdate,
  } satisfies SimulationUpdateMessage);

  await waitFor(() => {
    expect(useIdleStore.getState().activity?.id).toBe('activity_2');
  });

  ctx.emitWorkerMessage({
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
  const ctx = setupTest();
  const hook = renderHook(() => useSimulationTransport());

  hook.rerender();

  const message: WriterDisplacedMessage = {
    activityID: 'activity_1',
    type: WorkerMessageType.WriterDisplaced,
  };

  ctx.emitWorkerMessage(message);

  await waitFor(() => {
    expect(useIdleStore.getState().writerDisplacedActivityID).toBe('activity_1');
  });

  hook.unmount();
});
