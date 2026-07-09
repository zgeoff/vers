import type { ActivityCheckpoint, ActivityProgressCheckpoint } from '../types';
import { ActivityCheckpointType } from '../types';

export function isProgressCheckpoint(
  checkpoint: ActivityCheckpoint,
): checkpoint is ActivityProgressCheckpoint {
  return checkpoint.type === ActivityCheckpointType.Progress;
}
