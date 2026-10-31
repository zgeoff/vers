import { expect, onTestFinished, test } from 'bun:test';
import type { WorkerDebugSnapshot } from '@vers/idle-client';
import { waitFor } from '@vers/test-utils';
import invariant from 'tiny-invariant';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
import { createQARecordStore } from './create-qa-record-store';
import { QA_RECORD_KEYS } from './qa-record-keys';
import { registerQADebugHook } from './register-qa-debug-hook';

function setupTest() {
  const sender = new BroadcastChannel('vers-idle-worker-to-client');

  onTestFinished(() => {
    sender.close();
    sessionStorage.removeItem(QA_RECORD_KEYS.receivedOutcomes);
    localStorage.removeItem(QA_RECORD_KEYS.refusalCaptures);
  });

  const records = createQARecordStore({
    captures: () => localStorage,
    outcomes: () => sessionStorage,
  });

  return { records, sender };
}

test('it installs a snapshot function that merges the tab identity onto the worker answer', async () => {
  const ctx = setupTest();
  const client = createStubWorkerClient();

  const unregister = registerQADebugHook({
    client,
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 2,
  });

  onTestFinished(unregister);

  const snapshot = await globalThis.__versQA?.snapshot();

  expect(client.readDebugSnapshot).toHaveBeenCalledExactlyOnceWith({});

  expect(snapshot).toMatchObject({
    phase: 'idle',
    tab: { online: navigator.onLine, tabID: 'tab_1', writerGeneration: 2 },
  });

  expect(snapshot).toBeFrozen();
});

test('it freezes the tab record on the snapshot', async () => {
  const ctx = setupTest();

  const unregister = registerQADebugHook({
    client: createStubWorkerClient(),
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 2,
  });

  onTestFinished(unregister);

  const snapshot = await globalThis.__versQA?.snapshot();

  invariant(snapshot, 'the hook is installed');

  expect(snapshot.tab).toBeFrozen();
});

test('it removes the global on unregister', () => {
  const ctx = setupTest();

  const unregister = registerQADebugHook({
    client: createStubWorkerClient(),
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 0,
  });

  unregister();

  expect('__versQA' in globalThis).toBeFalse();
});

test('it leaves a newer registration in place when an older one unregisters', () => {
  const ctx = setupTest();

  const first = registerQADebugHook({
    client: createStubWorkerClient(),
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 0,
  });

  const second = registerQADebugHook({
    client: createStubWorkerClient(),
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 1,
  });

  onTestFinished(second);
  first();

  expect(globalThis.__versQA).toBeDefined();
});

test('it forwards a speed to the worker with the QA flag of the active avatar and answers the applied speed', async () => {
  const ctx = setupTest();
  const client = createStubWorkerClient();

  const unregister = registerQADebugHook({
    client,
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 0,
  });

  onTestFinished(unregister);

  const applied = await globalThis.__versQA?.setSpeed(12);

  expect(applied).toBe(12);

  expect(client.setSimulationSpeed).toHaveBeenCalledExactlyOnceWith({
    isQAAvatar: true,
    speed: 12,
  });
});

test('it throws when the worker refuses the speed for an avatar that is not flagged for QA', () => {
  const ctx = setupTest();

  const unregister = registerQADebugHook({
    client: createStubWorkerClient(),
    isQAAvatar: false,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 0,
  });

  onTestFinished(unregister);
  invariant(globalThis.__versQA, 'the hook is installed');

  expect(globalThis.__versQA.setSpeed(2)).rejects.toThrowWithMessage(Error, /not flagged for QA/u);
});

test('it rejects a speed outside 1 to 20 before asking the worker', () => {
  const ctx = setupTest();
  const client = createStubWorkerClient();

  const unregister = registerQADebugHook({
    client,
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 0,
  });

  onTestFinished(unregister);
  invariant(globalThis.__versQA, 'the hook is installed');

  expect(globalThis.__versQA.setSpeed(21)).rejects.toThrowWithMessage(RangeError, /1 to 20/u);
  expect(globalThis.__versQA.setSpeed(1.5)).rejects.toThrowWithMessage(RangeError, /integer/u);
  expect(client.setSimulationSpeed).not.toHaveBeenCalled();
});

test('it keeps a refusal captured at the moment it arrives until the next snapshot reads it', async () => {
  const ctx = setupTest();

  const unregister = registerQADebugHook({
    client: createStubWorkerClient(),
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 3,
  });

  onTestFinished(unregister);

  ctx.sender.postMessage({
    outcome: { activityID: 'act_refused', avatarID: 'avatar_1', kind: 'refused', xp: 0 },
    type: 'activity_ended',
    workerID: 'worker_other',
  });

  await waitFor(() => {
    expect(localStorage.getItem(QA_RECORD_KEYS.refusalCaptures)).toInclude('"complete"');
  });

  invariant(globalThis.__versQA, 'the hook is installed');

  const snapshot = await globalThis.__versQA.snapshot();

  const trigger = {
    outcome: { activityID: 'act_refused', avatarID: 'avatar_1', kind: 'refused', xp: 0 },
    receivedAt: expect.any(Number),
    workerID: 'worker_other',
  };

  expect(snapshot.refusalCaptures).toStrictEqual([
    {
      captureID: expect.any(String),
      capturedAt: expect.any(Number),
      pendingUntil: expect.any(Number),
      status: 'complete',
      tab: {
        hasSharedWorker: typeof SharedWorker !== 'undefined',
        online: navigator.onLine,
        receivedOutcomes: [trigger],
        tabID: 'tab_1',
        userAgent: navigator.userAgent,
        writerGeneration: 3,
      },
      trigger,
      worker: expect.objectContaining({ writer: { bootedAt: 0, workerID: 'worker_stub' } }),
    },
  ]);
});

test('it returns a capture with its worker snapshot from a snapshot call made before the worker answers', async () => {
  const ctx = setupTest();
  const captureRead = Promise.withResolvers<WorkerDebugSnapshot>();

  const unregister = registerQADebugHook({
    client: createStubWorkerClient({ readDebugSnapshot: () => captureRead.promise }),
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 0,
  });

  onTestFinished(unregister);

  ctx.sender.postMessage({
    outcome: { activityID: 'act_refused', avatarID: 'avatar_1', kind: 'refused', xp: 0 },
    type: 'activity_ended',
    workerID: 'worker_1',
  });

  await waitFor(() => {
    expect(localStorage.getItem(QA_RECORD_KEYS.refusalCaptures)).toInclude('"pending"');
  });

  invariant(globalThis.__versQA, 'the hook is installed');

  const hook = globalThis.__versQA;
  const pendingSnapshot = hook.snapshot();
  const storedBeforeReply = localStorage.getItem(QA_RECORD_KEYS.refusalCaptures);

  captureRead.resolve({
    capturedAt: 7,
    connectivityOnline: false,
    events: [],
    latestRun: null,
    liveRun: null,
    outbox: { activityStarts: [], checkpoints: [] },
    phase: 'idle',
    simulationSpeed: 1,
    writer: { bootedAt: 0, workerID: 'worker_answered' },
  });

  const snapshot = await pendingSnapshot;

  expect(storedBeforeReply).toInclude('"pending"');

  expect(snapshot.refusalCaptures).toStrictEqual([
    expect.objectContaining({
      status: 'complete',
      trigger: expect.objectContaining({ workerID: 'worker_1' }),
      worker: expect.objectContaining({ writer: { bootedAt: 0, workerID: 'worker_answered' } }),
    }),
  ]);

  expect(localStorage.getItem(QA_RECORD_KEYS.refusalCaptures)).toBeNull();
});

test('it keeps a pending capture for its worker answer across a re-registration of the hook', async () => {
  const ctx = setupTest();
  const captureRead = Promise.withResolvers<WorkerDebugSnapshot>();

  const first = registerQADebugHook({
    client: createStubWorkerClient({ readDebugSnapshot: () => captureRead.promise }),
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 0,
  });

  onTestFinished(first);

  ctx.sender.postMessage({
    outcome: { activityID: 'act_refused', avatarID: 'avatar_1', kind: 'refused', xp: 0 },
    type: 'activity_ended',
    workerID: 'worker_1',
  });

  await waitFor(() => {
    expect(localStorage.getItem(QA_RECORD_KEYS.refusalCaptures)).toInclude('"pending"');
  });

  first();

  const second = registerQADebugHook({
    client: createStubWorkerClient(),
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 1,
  });

  onTestFinished(second);
  invariant(globalThis.__versQA, 'the hook is installed');

  const pendingSnapshot = globalThis.__versQA.snapshot();

  captureRead.reject(new Error('the worker answered late'));

  const snapshot = await pendingSnapshot;

  expect(snapshot.refusalCaptures).toStrictEqual([
    expect.objectContaining({
      status: 'complete',
      workerError: 'Error: the worker answered late',
    }),
  ]);
});

test('it records the worker error in a refusal capture when the worker snapshot fails', async () => {
  const ctx = setupTest();

  const unregister = registerQADebugHook({
    client: createStubWorkerClient({
      readDebugSnapshot: () => Promise.reject(new Error('the worker port is closed')),
    }),
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 0,
  });

  onTestFinished(unregister);

  ctx.sender.postMessage({
    outcome: { activityID: 'act_refused', avatarID: 'avatar_1', kind: 'refused', xp: 0 },
    type: 'activity_ended',
    workerID: 'worker_1',
  });

  await waitFor(() => {
    expect(localStorage.getItem(QA_RECORD_KEYS.refusalCaptures)).toInclude('"complete"');
  });

  const stored: unknown = JSON.parse(localStorage.getItem(QA_RECORD_KEYS.refusalCaptures) ?? '');

  expect(stored).toStrictEqual([
    expect.objectContaining({ workerError: 'Error: the worker port is closed' }),
  ]);
});

test('it keeps the tab half of a refusal capture and records the timeout when the worker never answers', async () => {
  const ctx = setupTest();

  const unregister = registerQADebugHook({
    client: createStubWorkerClient({
      readDebugSnapshot: () => Promise.withResolvers<never>().promise,
    }),
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 20,
    writerGeneration: 0,
  });

  onTestFinished(unregister);

  ctx.sender.postMessage({
    outcome: { activityID: 'act_refused', avatarID: 'avatar_1', kind: 'refused', xp: 0 },
    type: 'activity_ended',
    workerID: 'worker_1',
  });

  await waitFor(() => {
    expect(localStorage.getItem(QA_RECORD_KEYS.refusalCaptures)).toInclude('"complete"');
  });

  const stored: unknown = JSON.parse(localStorage.getItem(QA_RECORD_KEYS.refusalCaptures) ?? '');

  expect(stored).toStrictEqual([
    expect.objectContaining({
      tab: expect.objectContaining({ tabID: 'tab_1' }),
      trigger: expect.objectContaining({ workerID: 'worker_1' }),
      workerError: 'Error: the worker sent no snapshot within 20 ms',
    }),
  ]);
});

test('it returns the saved captures from a snapshot whose worker never answers', async () => {
  const ctx = setupTest();

  ctx.records.addCapture({
    captureID: 'capture_1',
    capturedAt: 0,
    pendingUntil: 0,
    tab: {},
    trigger: {},
  });

  const unregister = registerQADebugHook({
    client: createStubWorkerClient({
      readDebugSnapshot: () => Promise.withResolvers<never>().promise,
    }),
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 20,
    writerGeneration: 0,
  });

  onTestFinished(unregister);
  invariant(globalThis.__versQA, 'the hook is installed');

  const snapshot = await globalThis.__versQA.snapshot();

  expect(snapshot).toMatchObject({
    refusalCaptures: [{ captureID: 'capture_1' }],
    workerError: 'Error: the worker sent no snapshot within 20 ms',
  });
});

test('it reports each capture write that a full storage quota refuses on the next snapshot', async () => {
  const ctx = setupTest();

  const records = createQARecordStore({
    captures: () => ({
      clear: () => {},
      getItem: () => '[]',
      key: () => null,
      length: 0,
      removeItem: () => {},
      setItem: () => {
        throw new DOMException('the storage quota is full', 'QuotaExceededError');
      },
    }),
    outcomes: () => sessionStorage,
  });

  const unregister = registerQADebugHook({
    client: createStubWorkerClient(),
    isQAAvatar: true,
    records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 0,
  });

  onTestFinished(unregister);

  ctx.sender.postMessage({
    outcome: { activityID: 'act_refused', avatarID: 'avatar_1', kind: 'refused', xp: 0 },
    type: 'activity_ended',
    workerID: 'worker_1',
  });

  invariant(globalThis.__versQA, 'the hook is installed');

  const hook = globalThis.__versQA;

  await waitFor(async () => {
    const snapshot = await hook.snapshot();

    expect(snapshot.captureFailures).toStrictEqual([
      'QuotaExceededError: the storage quota is full',
      'QuotaExceededError: the storage quota is full',
    ]);
  });
});

test('it saves a refusal capture and reports the read when the outcome storage throws on a read', async () => {
  const ctx = setupTest();

  const records = createQARecordStore({
    captures: () => localStorage,
    outcomes: () => ({
      clear: () => {},
      getItem: () => {
        throw new DOMException('the storage is blocked', 'SecurityError');
      },
      key: () => null,
      length: 0,
      removeItem: () => {},
      setItem: () => {},
    }),
  });

  const unregister = registerQADebugHook({
    client: createStubWorkerClient(),
    isQAAvatar: true,
    records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 0,
  });

  onTestFinished(unregister);

  ctx.sender.postMessage({
    outcome: { activityID: 'act_refused', avatarID: 'avatar_1', kind: 'refused', xp: 0 },
    type: 'activity_ended',
    workerID: 'worker_1',
  });

  await waitFor(() => {
    expect(localStorage.getItem(QA_RECORD_KEYS.refusalCaptures)).toInclude('"complete"');
  });

  const stored: unknown = JSON.parse(localStorage.getItem(QA_RECORD_KEYS.refusalCaptures) ?? '');

  expect(stored).toStrictEqual([
    expect.objectContaining({
      tab: expect.objectContaining({ receivedOutcomes: [] }),
      trigger: expect.objectContaining({ workerID: 'worker_1' }),
    }),
  ]);

  expect(records.readFailures()).toStrictEqual([
    'SecurityError: the storage is blocked',
    'SecurityError: the storage is blocked',
  ]);
});

test('it lists each outcome the tab received, with the sending worker', async () => {
  const ctx = setupTest();

  const unregister = registerQADebugHook({
    client: createStubWorkerClient(),
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 0,
  });

  onTestFinished(unregister);

  ctx.sender.postMessage({
    outcome: { activityID: 'act_done', avatarID: 'avatar_1', kind: 'completed', xp: 12 },
    type: 'activity_ended',
    workerID: 'worker_1',
  });

  invariant(globalThis.__versQA, 'the hook is installed');

  const hook = globalThis.__versQA;

  await waitFor(async () => {
    const snapshot = await hook.snapshot();

    expect(snapshot.tab.receivedOutcomes).toStrictEqual([
      {
        outcome: { activityID: 'act_done', avatarID: 'avatar_1', kind: 'completed', xp: 12 },
        receivedAt: expect.any(Number),
        workerID: 'worker_1',
      },
    ]);
  });
});

test('it captures a refused run and no completed one', async () => {
  const ctx = setupTest();

  const unregister = registerQADebugHook({
    client: createStubWorkerClient(),
    isQAAvatar: true,
    records: ctx.records,
    tabID: 'tab_1',
    workerTimeoutMs: 1000,
    writerGeneration: 0,
  });

  onTestFinished(unregister);

  ctx.sender.postMessage({
    outcome: { activityID: 'act_done', avatarID: 'avatar_1', kind: 'completed', xp: 12 },
    type: 'activity_ended',
    workerID: 'worker_1',
  });

  ctx.sender.postMessage({
    outcome: { activityID: 'act_refused', avatarID: 'avatar_1', kind: 'refused', xp: 0 },
    type: 'activity_ended',
    workerID: 'worker_1',
  });

  await waitFor(() => {
    expect(localStorage.getItem(QA_RECORD_KEYS.refusalCaptures)).toInclude('"complete"');
  });

  invariant(globalThis.__versQA, 'the hook is installed');

  const snapshot = await globalThis.__versQA.snapshot();

  expect(snapshot.refusalCaptures).toStrictEqual([
    expect.objectContaining({
      trigger: expect.objectContaining({
        outcome: { activityID: 'act_refused', avatarID: 'avatar_1', kind: 'refused', xp: 0 },
      }),
    }),
  ]);
});
