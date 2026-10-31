import { expect, onTestFinished, test } from 'bun:test';
import { createQARecordStore } from './create-qa-record-store';
import { QA_RECORD_KEYS } from './qa-record-keys';
import { readRefusalCaptures } from './read-refusal-captures';

function setupTest() {
  onTestFinished(() => {
    sessionStorage.removeItem(QA_RECORD_KEYS.receivedOutcomes);

    for (const entry of readRefusalCaptures(localStorage)) {
      localStorage.removeItem(entry.key);
    }
  });

  const records = createQARecordStore({
    captures: () => localStorage,
    outcomes: () => sessionStorage,
  });

  return { records };
}

test('it keeps a pending capture through a take until its worker part joins it', () => {
  const ctx = setupTest();

  ctx.records.addCapture({
    captureID: 'capture_1',
    capturedAt: 1000,
    tab: { tabID: 'tab_1' },
    trigger: { workerID: 'worker_1' },
  });

  const early = ctx.records.takeCaptures(1500);

  ctx.records.completeCapture('capture_1', { workerError: 'Error: the worker is busy' });

  const late = ctx.records.takeCaptures(1600);

  expect(early).toStrictEqual([
    {
      captureID: 'capture_1',
      capturedAt: 1000,
      pendingUntil: 601_000,
      status: 'pending',
      tab: { tabID: 'tab_1' },
      trigger: { workerID: 'worker_1' },
    },
  ]);

  expect(late).toStrictEqual([
    {
      captureID: 'capture_1',
      capturedAt: 1000,
      pendingUntil: 601_000,
      status: 'complete',
      tab: { tabID: 'tab_1' },
      trigger: { workerID: 'worker_1' },
      workerError: 'Error: the worker is busy',
    },
  ]);
});

test('it keeps both captures complete when two tabs interleave on different captures', () => {
  const ctx = setupTest();

  const otherTab = createQARecordStore({
    captures: () => localStorage,
    outcomes: () => sessionStorage,
  });

  ctx.records.addCapture({ captureID: 'capture_a', capturedAt: 1000, tab: {}, trigger: {} });
  otherTab.addCapture({ captureID: 'capture_b', capturedAt: 1001, tab: {}, trigger: {} });
  ctx.records.completeCapture('capture_a', { workerError: 'Error: worker a answered' });
  otherTab.completeCapture('capture_b', { workerError: 'Error: worker b answered' });

  const keys = readRefusalCaptures(localStorage).map((entry) => entry.key);
  const captures = ctx.records.takeCaptures(2000);

  expect(keys).toStrictEqual([
    'vers-qa-refusal-capture:capture_a',
    'vers-qa-refusal-capture:capture_b',
  ]);

  expect(captures).toStrictEqual([
    expect.objectContaining({
      captureID: 'capture_a',
      status: 'complete',
      workerError: 'Error: worker a answered',
    }),
    expect.objectContaining({
      captureID: 'capture_b',
      status: 'complete',
      workerError: 'Error: worker b answered',
    }),
  ]);
});

test('it hands a complete capture to one take only', () => {
  const ctx = setupTest();

  ctx.records.addCapture({ captureID: 'capture_1', capturedAt: 1000, tab: {}, trigger: {} });
  ctx.records.completeCapture('capture_1', { workerError: 'Error: the worker is busy' });
  ctx.records.takeCaptures(1500);

  expect(ctx.records.takeCaptures(1600)).toStrictEqual([]);
});

test('it keeps a pending capture for 10 minutes and drops it after one take past that', () => {
  const ctx = setupTest();

  ctx.records.addCapture({ captureID: 'capture_1', capturedAt: 1000, tab: {}, trigger: {} });
  ctx.records.takeCaptures(600_999);

  const beforeLifetime = ctx.records.takeCaptures(601_000);
  const afterLifetime = ctx.records.takeCaptures(601_001);

  expect(beforeLifetime).toStrictEqual([expect.objectContaining({ captureID: 'capture_1' })]);
  expect(afterLifetime).toStrictEqual([]);
});

test('it keeps the newest 10 captures', () => {
  const ctx = setupTest();

  for (let index = 1; index <= 11; index += 1) {
    ctx.records.addCapture({
      captureID: `capture_${index}`,
      capturedAt: index * 1000,
      tab: {},
      trigger: {},
    });
  }

  expect(ctx.records.takeCaptures(20_000)).toStrictEqual(
    Array.from({ length: 10 }, (_, index) =>
      expect.objectContaining({ captureID: `capture_${index + 2}` }),
    ),
  );
});

test('it keeps the latest 50 received outcomes', () => {
  const ctx = setupTest();

  for (let index = 1; index <= 51; index += 1) {
    ctx.records.addReceivedOutcome({ activityID: `act_${index}` });
  }

  expect(ctx.records.readReceivedOutcomes()).toStrictEqual(
    Array.from({ length: 50 }, (_, index) => ({ activityID: `act_${index + 2}` })),
  );
});

test('it records a storage write that fails and carries on', () => {
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

  records.addCapture({
    captureID: 'capture_1',
    capturedAt: 1000,
    tab: {},
    trigger: {},
  });

  expect(records.readFailures()).toStrictEqual(['QuotaExceededError: the storage quota is full']);
});

test('it records a storage read that fails and reads no records', () => {
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

  const outcomes = records.readReceivedOutcomes();

  expect(outcomes).toStrictEqual([]);
  expect(records.readFailures()).toStrictEqual(['SecurityError: the storage is blocked']);
});

test('it records a storage property that a browser policy blocks and carries on', () => {
  const records = createQARecordStore({
    captures: () => {
      throw new DOMException('the origin may not use storage', 'SecurityError');
    },
    outcomes: () => {
      throw new DOMException('the origin may not use storage', 'SecurityError');
    },
  });

  records.addCapture({
    captureID: 'capture_1',
    capturedAt: 1000,
    tab: {},
    trigger: {},
  });

  const captures = records.takeCaptures(1500);
  const outcomes = records.readReceivedOutcomes();

  expect(captures).toStrictEqual([]);
  expect(outcomes).toStrictEqual([]);

  expect(records.readFailures()).toStrictEqual([
    'SecurityError: the origin may not use storage',
    'SecurityError: the origin may not use storage',
    'SecurityError: the origin may not use storage',
  ]);
});
