import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createMockCheckpointBatchEntry } from '../test-utils/factories/create-mock-checkpoint-batch-entry';
import { collectOwnedActivityIDs } from './collect-owned-activity-ids';

test('it keeps an activity start whose avatar the roster owns', () => {
  const start = createMockActivityData({ avatarID: 'avatar-owned' });

  const owned = collectOwnedActivityIDs({
    avatarIDs: ['avatar-owned'],
    checkpoints: [],
    starts: [start],
  });

  expect(owned).toStrictEqual(new Set([start.id]));
});

test('it leaves out an activity start whose avatar the roster does not own', () => {
  const start = createMockActivityData({ avatarID: 'avatar-foreign' });

  const owned = collectOwnedActivityIDs({
    avatarIDs: ['avatar-owned'],
    checkpoints: [],
    starts: [start],
  });

  expect(owned).toStrictEqual(new Set());
});

test('it leaves out the checkpoints queued behind an activity start the roster does not own', () => {
  const start = createMockActivityData({ avatarID: 'avatar-foreign' });

  const owned = collectOwnedActivityIDs({
    avatarIDs: ['avatar-owned'],
    checkpoints: [{ ...createMockCheckpointBatchEntry(), activityID: start.id }],
    starts: [start],
  });

  expect(owned).toStrictEqual(new Set());
});

test('it keeps a checkpoint whose activity start the server already admitted', () => {
  const owned = collectOwnedActivityIDs({
    avatarIDs: [],
    checkpoints: [{ ...createMockCheckpointBatchEntry(), activityID: 'act-admitted' }],
    starts: [],
  });

  expect(owned).toStrictEqual(new Set(['act-admitted']));
});

test('it separates owned and foreign activity starts held side by side', () => {
  const ownedStart = createMockActivityData({ avatarID: 'avatar-owned' });
  const foreignStart = createMockActivityData({ avatarID: 'avatar-foreign' });

  const owned = collectOwnedActivityIDs({
    avatarIDs: ['avatar-owned', 'avatar-second'],
    checkpoints: [
      { ...createMockCheckpointBatchEntry(), activityID: ownedStart.id },
      { ...createMockCheckpointBatchEntry(), activityID: foreignStart.id },
    ],
    starts: [ownedStart, foreignStart],
  });

  expect(owned).toStrictEqual(new Set([ownedStart.id]));
});
