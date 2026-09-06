import { expect, test } from 'bun:test';
import { ActivityCheckpointType } from '@vers/idle-core';
import { createMockRunOutcome } from '../test-utils/factories/create-mock-run-outcome';
import { setRunOutcome } from './set-run-outcome';
import { useIdleStore } from './use-idle-store';

test('it records the outcome of the run that ended', () => {
  const outcome = createMockRunOutcome({ kind: ActivityCheckpointType.Failed, xp: 118 });

  setRunOutcome(outcome);

  expect(useIdleStore.getState().runOutcome).toStrictEqual(outcome);
});

test('it marks a cleared run as the last completed activity', () => {
  const outcome = createMockRunOutcome({ kind: ActivityCheckpointType.Completed });

  setRunOutcome(outcome);

  expect(useIdleStore.getState().lastCompletedActivityID).toBe(outcome.activityID);
});

test('it leaves the last completed activity alone when the run failed', () => {
  useIdleStore.setState({ lastCompletedActivityID: 'activity_0' });

  setRunOutcome(createMockRunOutcome({ kind: ActivityCheckpointType.Failed }));

  expect(useIdleStore.getState().lastCompletedActivityID).toBe('activity_0');
});
