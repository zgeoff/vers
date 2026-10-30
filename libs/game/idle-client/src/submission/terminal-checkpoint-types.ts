import { ActivityCheckpointType } from '@vers/idle-core';

export const TERMINAL_CHECKPOINT_TYPES: ReadonlySet<string> = new Set([
  ActivityCheckpointType.Completed,
  ActivityCheckpointType.Failed,
]);
