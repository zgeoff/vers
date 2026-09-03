import { expect, test } from 'bun:test';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { buildUndeliveredWork } from './build-undelivered-work';

test('it counts the union of pending starts and checkpoint activities', () => {
  const work = buildUndeliveredWork({
    checkpoints: [
      { ...createMockCheckpointBatchEntry({ payload: { time: 0 } }), activityID: 'act-checkpoint' },
    ],
    startIDs: ['act-start'],
  });

  expect(work).toStrictEqual({ activityCount: 2, playMs: 0 });
});

test('it does not double-count an activity that appears in two inputs', () => {
  const work = buildUndeliveredWork({
    checkpoints: [
      { ...createMockCheckpointBatchEntry({ payload: { time: 0 } }), activityID: 'act-both' },
    ],
    startIDs: ['act-both'],
  });

  expect(work).toStrictEqual({ activityCount: 1, playMs: 0 });
});

test('it sums per-activity spans across activities', () => {
  const work = buildUndeliveredWork({
    checkpoints: [
      { ...createMockCheckpointBatchEntry({ payload: { time: 1000 } }), activityID: 'act-a' },
      { ...createMockCheckpointBatchEntry({ payload: { time: 4000 } }), activityID: 'act-a' },
      { ...createMockCheckpointBatchEntry({ payload: { time: 500 } }), activityID: 'act-b' },
      { ...createMockCheckpointBatchEntry({ payload: { time: 2500 } }), activityID: 'act-b' },
    ],
    startIDs: [],
  });

  expect(work).toStrictEqual({ activityCount: 2, playMs: 5000 });
});

test('it returns 0 ms for a single queued row', () => {
  const work = buildUndeliveredWork({
    checkpoints: [
      { ...createMockCheckpointBatchEntry({ payload: { time: 4000 } }), activityID: 'act-single' },
    ],
    startIDs: [],
  });

  expect(work).toStrictEqual({ activityCount: 1, playMs: 0 });
});
