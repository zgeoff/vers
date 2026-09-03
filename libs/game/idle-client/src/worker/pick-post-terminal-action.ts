import { ActivityCheckpointType, ActivityFailureAction } from '@vers/idle-core';

interface PickPostTerminalActionInput {
  readonly checkpointType: ActivityCheckpointType;
  readonly failureAction: ActivityFailureAction;
  readonly remainingBudgetMs: number;
}

export type PostTerminalAction = 'halt-at-boundary' | 'start-next' | 'stop';

export function pickPostTerminalAction(
  input: Readonly<PickPostTerminalActionInput>,
): PostTerminalAction {
  const isAbortedFailure =
    input.checkpointType === ActivityCheckpointType.Failed &&
    input.failureAction === ActivityFailureAction.Abort;

  if (isAbortedFailure) {
    return 'stop';
  }

  if (input.remainingBudgetMs <= 0) {
    return 'halt-at-boundary';
  }

  return 'start-next';
}
