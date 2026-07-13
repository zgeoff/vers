import { expect, test } from 'bun:test';
import { createMockCompletedCheckpoint } from '../test-utils/create-mock-completed-checkpoint';
import { createMockFailedCheckpoint } from '../test-utils/create-mock-failed-checkpoint';
import { createMockProgressCheckpoint } from '../test-utils/create-mock-progress-checkpoint';
import { createMockStartedCheckpoint } from '../test-utils/create-mock-started-checkpoint';
import { isCompletedCheckpoint } from './is-completed-checkpoint';

test('it identifies a completed checkpoint', () => {
  expect(isCompletedCheckpoint(createMockCompletedCheckpoint())).toBeTrue();
});

test('it rejects every other checkpoint type', () => {
  expect(isCompletedCheckpoint(createMockStartedCheckpoint())).toBeFalse();
  expect(isCompletedCheckpoint(createMockFailedCheckpoint())).toBeFalse();
  expect(isCompletedCheckpoint(createMockProgressCheckpoint())).toBeFalse();
});
