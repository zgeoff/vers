import type { ActivityStatus } from '@vers/db';
import { TERMINAL_CHECKPOINT_TYPES } from './types';

/**
 * Reports whether an activity has left `active` play for good having actually consumed part of
 * its allotted seed-chain span: a terminal checkpoint type, or a `stopped`/`capped` status, but
 * never when the checkpoint is the `started` one — that type carries no consumption of its own, so
 * an activity behind it never advanced.
 */
export function isForwardExited(checkpointType: string, status: ActivityStatus): boolean {
  if (checkpointType === 'started') {
    return false;
  }

  return (
    TERMINAL_CHECKPOINT_TYPES.has(checkpointType) || status === 'stopped' || status === 'capped'
  );
}
