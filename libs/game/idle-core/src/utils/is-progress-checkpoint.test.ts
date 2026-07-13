import { expect, test } from 'bun:test';
import { createMockCompletedCheckpoint } from '../test-utils/create-mock-completed-checkpoint';
import { createMockFailedCheckpoint } from '../test-utils/create-mock-failed-checkpoint';
import { createMockProgressCheckpoint } from '../test-utils/create-mock-progress-checkpoint';
import { createMockStartedCheckpoint } from '../test-utils/create-mock-started-checkpoint';
import { isProgressCheckpoint } from './is-progress-checkpoint';

test('returns true for progress checkpoints', () => {
  expect(isProgressCheckpoint(createMockProgressCheckpoint())).toBeTrue();
});

test('returns false for non-progress checkpoints', () => {
  expect(isProgressCheckpoint(createMockStartedCheckpoint())).toBeFalse();
  expect(isProgressCheckpoint(createMockCompletedCheckpoint())).toBeFalse();
  expect(isProgressCheckpoint(createMockFailedCheckpoint())).toBeFalse();
});
