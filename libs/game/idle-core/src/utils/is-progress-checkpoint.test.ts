import { expect, test } from 'bun:test';
import { createMockCompletedCheckpoint } from '../test-utils/factories/create-mock-completed-checkpoint';
import { createMockFailedCheckpoint } from '../test-utils/factories/create-mock-failed-checkpoint';
import { createMockProgressCheckpoint } from '../test-utils/factories/create-mock-progress-checkpoint';
import { createMockStartedCheckpoint } from '../test-utils/factories/create-mock-started-checkpoint';
import { isProgressCheckpoint } from './is-progress-checkpoint';

test('it identifies a progress checkpoint', () => {
  expect(isProgressCheckpoint(createMockProgressCheckpoint())).toBeTrue();
});

test('it rejects every other checkpoint type', () => {
  expect(isProgressCheckpoint(createMockStartedCheckpoint())).toBeFalse();
  expect(isProgressCheckpoint(createMockCompletedCheckpoint())).toBeFalse();
  expect(isProgressCheckpoint(createMockFailedCheckpoint())).toBeFalse();
});
