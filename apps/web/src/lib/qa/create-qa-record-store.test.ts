import { expect, onTestFinished, test } from 'bun:test';
import { createQARecordStore } from './create-qa-record-store';
import { QA_RECORD_KEYS } from './qa-record-keys';

function setupTest() {
  onTestFinished(() => {
    sessionStorage.removeItem(QA_RECORD_KEYS.receivedOutcomes);
    localStorage.removeItem(QA_RECORD_KEYS.refusalCaptures);
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
    pendingUntil: 3000,
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
      pendingUntil: 3000,
      status: 'pending',
      tab: { tabID: 'tab_1' },
      trigger: { workerID: 'worker_1' },
    },
  ]);

  expect(late).toStrictEqual([
    {
      captureID: 'capture_1',
      capturedAt: 1000,
      pendingUntil: 3000,
      status: 'complete',
      tab: { tabID: 'tab_1' },
      trigger: { workerID: 'worker_1' },
      workerError: 'Error: the worker is busy',
    },
  ]);
});

test('it hands a complete capture to one take only', () => {
  const ctx = setupTest();

  ctx.records.addCapture({
    captureID: 'capture_1',
    capturedAt: 1000,
    pendingUntil: 3000,
    tab: {},
    trigger: {},
  });

  ctx.records.completeCapture('capture_1', { workerError: 'Error: the worker is busy' });
  ctx.records.takeCaptures(1500);

  expect(ctx.records.takeCaptures(1600)).toStrictEqual([]);
});

test('it drops a pending capture past its deadline after one take returns it', () => {
  const ctx = setupTest();

  ctx.records.addCapture({
    captureID: 'capture_1',
    capturedAt: 1000,
    pendingUntil: 3000,
    tab: {},
    trigger: {},
  });

  ctx.records.takeCaptures(3000);

  expect(ctx.records.takeCaptures(3001)).toStrictEqual([]);
});

test('it keeps the latest 10 captures', () => {
  const ctx = setupTest();

  for (let index = 1; index <= 11; index += 1) {
    ctx.records.addCapture({
      captureID: `capture_${index}`,
      capturedAt: 1000,
      pendingUntil: 3000,
      tab: {},
      trigger: {},
    });
  }

  expect(ctx.records.takeCaptures(1500)).toStrictEqual(
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
    pendingUntil: 3000,
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
    pendingUntil: 3000,
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
    'SecurityError: the origin may not use storage',
  ]);
});
