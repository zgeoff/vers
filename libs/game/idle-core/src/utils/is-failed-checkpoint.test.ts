import { expect, test } from 'bun:test';
import { createMockCompletedCheckpoint } from '../test-utils/create-mock-completed-checkpoint';
import { createMockFailedCheckpoint } from '../test-utils/create-mock-failed-checkpoint';
import { createMockProgressCheckpoint } from '../test-utils/create-mock-progress-checkpoint';
import { createMockStartedCheckpoint } from '../test-utils/create-mock-started-checkpoint';
import { isFailedCheckpoint } from './is-failed-checkpoint';

test('returns true for failed checkpoints', () => {
  expect(isFailedCheckpoint(createMockFailedCheckpoint())).toBeTrue();
});

test('returns false for non-failed checkpoints', () => {
  expect(isFailedCheckpoint(createMockStartedCheckpoint())).toBeFalse();
  expect(isFailedCheckpoint(createMockCompletedCheckpoint())).toBeFalse();
  expect(isFailedCheckpoint(createMockProgressCheckpoint())).toBeFalse();
});
