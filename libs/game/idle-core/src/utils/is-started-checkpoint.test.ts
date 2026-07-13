import { expect, test } from 'bun:test';
import { createMockCompletedCheckpoint } from '../test-utils/create-mock-completed-checkpoint';
import { createMockFailedCheckpoint } from '../test-utils/create-mock-failed-checkpoint';
import { createMockProgressCheckpoint } from '../test-utils/create-mock-progress-checkpoint';
import { createMockStartedCheckpoint } from '../test-utils/create-mock-started-checkpoint';
import { isStartedCheckpoint } from './is-started-checkpoint';

test('returns true for started checkpoints', () => {
  expect(isStartedCheckpoint(createMockStartedCheckpoint())).toBeTrue();
});

test('returns false for non-started checkpoints', () => {
  expect(isStartedCheckpoint(createMockCompletedCheckpoint())).toBeFalse();
  expect(isStartedCheckpoint(createMockFailedCheckpoint())).toBeFalse();
  expect(isStartedCheckpoint(createMockProgressCheckpoint())).toBeFalse();
});
