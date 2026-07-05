import type { ActivityCheckpoint, ActivityStartedCheckpoint } from '../types';
import { ActivityCheckpointType } from '../types';

export function isStartedCheckpoint(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  checkpoint: ActivityCheckpoint,
): checkpoint is ActivityStartedCheckpoint {
  return checkpoint.type === ActivityCheckpointType.Started;
}
