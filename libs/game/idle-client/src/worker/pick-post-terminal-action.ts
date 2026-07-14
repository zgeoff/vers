import { ActivityCheckpointType, ActivityFailureAction } from '@vers/idle-core';

interface PickPostTerminalActionInput {
  readonly checkpointType: ActivityCheckpointType;
  readonly failureAction: ActivityFailureAction;
  readonly remainingBudgetMs: number;
}

export type PostTerminalAction = 'halt-at-boundary' | 'start-next' | 'stop';

/**
 * Decides what follows a terminal checkpoint. Player intent wins first: a failure under the
 * abort policy stops the simulation. An exhausted offline-progress budget halts at the boundary
 * — the simulation idles on its last state instead of tearing down, so a resync replaces it
 * seamlessly — and only a funded, willing stream starts its next attempt. The policy is identical
 * online and offline.
 */
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
