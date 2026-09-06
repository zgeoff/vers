import { expect, test } from 'bun:test';
import { ActivityCheckpointType } from '@vers/idle-core';
import { setRunOutcome } from './set-run-outcome';
import { useIdleStore } from './use-idle-store';

test('it records the outcome of the run that ended', () => {
  setRunOutcome({ activityID: 'activity_1', kind: ActivityCheckpointType.Failed, xp: 118 });

  expect(useIdleStore.getState().runOutcome).toStrictEqual({
    activityID: 'activity_1',
    kind: ActivityCheckpointType.Failed,
    xp: 118,
  });
});

test('it marks a cleared run as the last completed activity', () => {
  setRunOutcome({ activityID: 'activity_1', kind: ActivityCheckpointType.Completed, xp: 240 });

  expect(useIdleStore.getState().lastCompletedActivityID).toBe('activity_1');
});

test('it leaves the last completed activity alone when the run failed', () => {
  useIdleStore.setState({ lastCompletedActivityID: 'activity_0' });

  setRunOutcome({ activityID: 'activity_1', kind: ActivityCheckpointType.Failed, xp: 118 });

  expect(useIdleStore.getState().lastCompletedActivityID).toBe('activity_0');
});
