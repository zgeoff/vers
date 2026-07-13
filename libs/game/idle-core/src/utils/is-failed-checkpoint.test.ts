import { expect, test } from 'bun:test';
import type {
  ActivityCompletedCheckpoint,
  ActivityFailedCheckpoint,
  ActivityProgressCheckpoint,
  ActivityStartedCheckpoint,
} from '../types';
import { ActivityCheckpointType } from '../types';
import { isFailedCheckpoint } from './is-failed-checkpoint';

test('returns true for failed checkpoints', () => {
  const failedCheckpoint: ActivityFailedCheckpoint = {
    nextSeed: '12345',
    rewards: { xp: 0 },
    time: 500,
    type: ActivityCheckpointType.Failed,
  };

  expect(isFailedCheckpoint(failedCheckpoint)).toBeTrue();
});

test('returns false for non-failed checkpoints', () => {
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

  const progressCheckpoint: ActivityProgressCheckpoint = {
    nextSeed: '24680',
    rewards: { xp: 0 },
    time: 300,
    type: ActivityCheckpointType.Progress,
  };

  expect(isFailedCheckpoint(startedCheckpoint)).toBeFalse();
  expect(isFailedCheckpoint(completedCheckpoint)).toBeFalse();
  expect(isFailedCheckpoint(progressCheckpoint)).toBeFalse();
});
