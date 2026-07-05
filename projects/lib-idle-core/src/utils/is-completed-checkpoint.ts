import type { ActivityCheckpoint, ActivityCompletedCheckpoint } from '../types';
import { ActivityCheckpointType } from '../types';

export function isCompletedCheckpoint(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  checkpoint: ActivityCheckpoint,
): checkpoint is ActivityCompletedCheckpoint {
  return checkpoint.type === ActivityCheckpointType.Completed;
}
