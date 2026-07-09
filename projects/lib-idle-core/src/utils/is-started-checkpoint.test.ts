import { expect, test } from 'bun:test';
import type {
  ActivityCompletedCheckpoint,
  ActivityFailedCheckpoint,
  ActivityProgressCheckpoint,
  ActivityStartedCheckpoint,
} from '../types';
import { ActivityCheckpointType } from '../types';
import { isStartedCheckpoint } from './is-started-checkpoint';

test('returns true for started checkpoints', () => {
  const startedCheckpoint: ActivityStartedCheckpoint = {
    hash: 'abc123',
    seed: 12_345,
    time: 0,
    type: ActivityCheckpointType.Started,
  };

  expect(isStartedCheckpoint(startedCheckpoint)).toBeTrue();
});

test('returns false for non-started checkpoints', () => {
  const completedCheckpoint: ActivityCompletedCheckpoint = {
    hash: 'def456',
    nextSeed: 54_321,
    time: 1000,
    type: ActivityCheckpointType.Completed,
  };

  const failedCheckpoint: ActivityFailedCheckpoint = {
    hash: 'ghi789',
    nextSeed: 98_765,
    time: 500,
    type: ActivityCheckpointType.Failed,
  };

  const progressCheckpoint: ActivityProgressCheckpoint = {
    hash: 'jkl012',
    nextSeed: 24_680,
    time: 300,
    type: ActivityCheckpointType.Progress,
  };

  expect(isStartedCheckpoint(completedCheckpoint)).toBeFalse();
  expect(isStartedCheckpoint(failedCheckpoint)).toBeFalse();
  expect(isStartedCheckpoint(progressCheckpoint)).toBeFalse();
});
