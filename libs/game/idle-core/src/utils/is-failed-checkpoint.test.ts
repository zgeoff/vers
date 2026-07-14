import { expect, test } from 'bun:test';
import { createMockCompletedCheckpoint } from '../test-utils/factories/create-mock-completed-checkpoint';
import { createMockFailedCheckpoint } from '../test-utils/factories/create-mock-failed-checkpoint';
import { createMockProgressCheckpoint } from '../test-utils/factories/create-mock-progress-checkpoint';
import { createMockStartedCheckpoint } from '../test-utils/factories/create-mock-started-checkpoint';
import { isFailedCheckpoint } from './is-failed-checkpoint';

test('it identifies a failed checkpoint', () => {
  expect(isFailedCheckpoint(createMockFailedCheckpoint())).toBeTrue();
});

test('it rejects every other checkpoint type', () => {
  expect(isFailedCheckpoint(createMockStartedCheckpoint())).toBeFalse();
  expect(isFailedCheckpoint(createMockCompletedCheckpoint())).toBeFalse();
  expect(isFailedCheckpoint(createMockProgressCheckpoint())).toBeFalse();
});
