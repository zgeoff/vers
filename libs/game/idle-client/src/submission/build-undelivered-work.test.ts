import { expect, test } from 'bun:test';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { buildUndeliveredWork } from './build-undelivered-work';

test('it counts the union of pending starts, checkpoint activities, and the live run', () => {
  const work = buildUndeliveredWork({
    checkpoints: [
      { ...createMockCheckpointBatchEntry({ payload: { time: 0 } }), activityID: 'act-checkpoint' },
    ],
    runningActivityID: 'act-running',
    startIDs: ['act-start'],
  });

  expect(work.activityCount).toBe(3);
});

test('it counts a live run holding no queued rows', () => {
  const work = buildUndeliveredWork({
    checkpoints: [],
    runningActivityID: 'act-running',
    startIDs: [],
  });

  expect(work.activityCount).toBe(1);
});

test('it does not double-count an activity that appears in two inputs', () => {
  const work = buildUndeliveredWork({
    checkpoints: [
      { ...createMockCheckpointBatchEntry({ payload: { time: 0 } }), activityID: 'act-both' },
    ],
    runningActivityID: 'act-both',
    startIDs: ['act-both'],
  });

  expect(work.activityCount).toBe(1);
});

test('it sums per-activity spans across activities', () => {
  const work = buildUndeliveredWork({
    checkpoints: [
      { ...createMockCheckpointBatchEntry({ payload: { time: 1000 } }), activityID: 'act-a' },
      { ...createMockCheckpointBatchEntry({ payload: { time: 4000 } }), activityID: 'act-a' },
      { ...createMockCheckpointBatchEntry({ payload: { time: 500 } }), activityID: 'act-b' },
      { ...createMockCheckpointBatchEntry({ payload: { time: 2500 } }), activityID: 'act-b' },
    ],
    runningActivityID: null,
    startIDs: [],
  });

  expect(work.playMs).toBe(5000);
});

test('it returns 0 ms for a single queued row', () => {
  const work = buildUndeliveredWork({
    checkpoints: [
      { ...createMockCheckpointBatchEntry({ payload: { time: 4000 } }), activityID: 'act-single' },
    ],
    runningActivityID: null,
    startIDs: [],
  });

  expect(work.playMs).toBe(0);
});
