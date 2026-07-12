import { expect, test } from 'bun:test';
import type {
  ActivityCompletedCheckpoint,
  ActivityFailedCheckpoint,
  ActivityProgressCheckpoint,
  ActivityStartedCheckpoint,
} from '../types';
import { ActivityCheckpointType } from '../types';
import { isCompletedCheckpoint } from './is-completed-checkpoint';

test('returns true for completed checkpoints', () => {
  const completedCheckpoint: ActivityCompletedCheckpoint = {
    hash: 'abc123',
    nextSeed: '12345',
    rewards: { xp: 0 },
    time: 1000,
    type: ActivityCheckpointType.Completed,
  };

  expect(isCompletedCheckpoint(completedCheckpoint)).toBeTrue();
});

test('returns false for non-completed checkpoints', () => {
  const startedCheckpoint: ActivityStartedCheckpoint = {
    hash: 'def456',
    seed: '54321',
    rewards: { xp: 0 },
    time: 0,
    type: ActivityCheckpointType.Started,
  };

  const failedCheckpoint: ActivityFailedCheckpoint = {
    hash: 'ghi789',
    nextSeed: '98765',
    rewards: { xp: 0 },
    time: 500,
    type: ActivityCheckpointType.Failed,
  };

  const progressCheckpoint: ActivityProgressCheckpoint = {
    hash: 'jkl012',
    nextSeed: '24680',
    rewards: { xp: 0 },
    time: 300,
    type: ActivityCheckpointType.Progress,
  };

  expect(isCompletedCheckpoint(startedCheckpoint)).toBeFalse();
  expect(isCompletedCheckpoint(failedCheckpoint)).toBeFalse();
  expect(isCompletedCheckpoint(progressCheckpoint)).toBeFalse();
});
