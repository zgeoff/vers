import type { ActivityCheckpoint, ActivityCompletedCheckpoint } from '../types';
import { ActivityCheckpointType } from '../types';

export function isCompletedCheckpoint(
  checkpoint: ActivityCheckpoint,
): checkpoint is ActivityCompletedCheckpoint {
  return checkpoint.type === ActivityCheckpointType.Completed;
}
