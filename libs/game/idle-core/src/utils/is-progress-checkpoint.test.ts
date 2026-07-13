import { expect, test } from 'bun:test';
import type {
  ActivityCompletedCheckpoint,
  ActivityFailedCheckpoint,
  ActivityProgressCheckpoint,
  ActivityStartedCheckpoint,
} from '../types';
import { ActivityCheckpointType } from '../types';
import { isProgressCheckpoint } from './is-progress-checkpoint';

test('returns true for progress checkpoints', () => {
  const progressCheckpoint: ActivityProgressCheckpoint = {
    nextSeed: '12345',
    rewards: { xp: 0 },
    time: 300,
    type: ActivityCheckpointType.Progress,
  };

  expect(isProgressCheckpoint(progressCheckpoint)).toBeTrue();
});

test('returns false for non-progress checkpoints', () => {
  const startedCheckpoint: ActivityStartedCheckpoint = {
    nextSeed: '54321',
    seed: '54321',
    rewards: { xp: 0 },
    time: 0,
    type: ActivityCheckpointType.Started,
  };

  const completedCheckpoint: ActivityCompletedCheckpoint = {
    nextSeed: '98765',
    rewards: { xp: 0 },
    time: 1000,
    type: ActivityCheckpointType.Completed,
  };

  const failedCheckpoint: ActivityFailedCheckpoint = {
    nextSeed: '24680',
    rewards: { xp: 0 },
    time: 500,
    type: ActivityCheckpointType.Failed,
  };

  expect(isProgressCheckpoint(startedCheckpoint)).toBeFalse();
  expect(isProgressCheckpoint(completedCheckpoint)).toBeFalse();
  expect(isProgressCheckpoint(failedCheckpoint)).toBeFalse();
});
