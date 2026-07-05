import type { ActivityCheckpoint, ActivityFailedCheckpoint } from '../types';
import { ActivityCheckpointType } from '../types';

export function isFailedCheckpoint(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  checkpoint: ActivityCheckpoint,
): checkpoint is ActivityFailedCheckpoint {
  return checkpoint.type === ActivityCheckpointType.Failed;
}
