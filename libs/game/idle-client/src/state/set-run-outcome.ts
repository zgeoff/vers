import { ActivityCheckpointType } from '@vers/idle-core';
import type { RunOutcome } from '../types';
import { useIdleStore } from './use-idle-store';

export function setRunOutcome(outcome: RunOutcome) {
  useIdleStore.setState(() => ({
    runOutcome: outcome,
    ...(outcome.kind === ActivityCheckpointType.Completed && {
      lastCompletedActivityID: outcome.activityID,
    }),
  }));
}
