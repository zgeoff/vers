import type { ActivityCheckpoint, ActivityFailedCheckpoint } from '../types';
import { ActivityCheckpointType } from '../types';

export function isFailedCheckpoint(
  checkpoint: ActivityCheckpoint,
): checkpoint is ActivityFailedCheckpoint {
  return checkpoint.type === ActivityCheckpointType.Failed;
}
