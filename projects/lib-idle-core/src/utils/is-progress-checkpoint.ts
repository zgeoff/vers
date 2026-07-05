import type { ActivityCheckpoint, ActivityProgressCheckpoint } from '../types';
import { ActivityCheckpointType } from '../types';

export function isProgressCheckpoint(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  checkpoint: ActivityCheckpoint,
): checkpoint is ActivityProgressCheckpoint {
  return checkpoint.type === ActivityCheckpointType.Progress;
}
