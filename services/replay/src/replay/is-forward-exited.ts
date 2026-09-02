import type { ActivityStatus } from '@vers/db';
import { TERMINAL_CHECKPOINT_TYPES } from './types';

export function isForwardExited(checkpointType: string, status: ActivityStatus): boolean {
  if (checkpointType === 'started') {
    return false;
  }

  return (
    TERMINAL_CHECKPOINT_TYPES.has(checkpointType) || status === 'stopped' || status === 'capped'
  );
}
