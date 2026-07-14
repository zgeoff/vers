import { expect, test } from 'bun:test';
import { ActivityCheckpointType, ActivityFailureAction } from '@vers/idle-core';
import { pickPostTerminalAction } from './pick-post-terminal-action';

test.each([
  [ActivityCheckpointType.Failed, ActivityFailureAction.Abort, 1000, 'stop'],
  [ActivityCheckpointType.Failed, ActivityFailureAction.Abort, 0, 'stop'],
  [ActivityCheckpointType.Failed, ActivityFailureAction.Retry, 1000, 'start-next'],
  [ActivityCheckpointType.Failed, ActivityFailureAction.Retry, 0, 'halt-at-boundary'],
  [ActivityCheckpointType.Completed, ActivityFailureAction.Abort, 1000, 'start-next'],
  [ActivityCheckpointType.Completed, ActivityFailureAction.Retry, 0, 'halt-at-boundary'],
  [ActivityCheckpointType.Completed, ActivityFailureAction.Retry, -1, 'halt-at-boundary'],
] as const)(
  'it resolves %s under %s with %dms budget to %s',
  (checkpointType, failureAction, remainingBudgetMs, expected) => {
    const action = pickPostTerminalAction({ checkpointType, failureAction, remainingBudgetMs });

    expect(action).toBe(expected);
  },
);
