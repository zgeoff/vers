import type { ActivityCheckpoint, ActivityStartedCheckpoint } from '../types';
import { ActivityCheckpointType } from '../types';

export function isStartedCheckpoint(
  checkpoint: ActivityCheckpoint,
): checkpoint is ActivityStartedCheckpoint {
  return checkpoint.type === ActivityCheckpointType.Started;
}
