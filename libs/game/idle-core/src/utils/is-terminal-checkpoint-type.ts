import { ActivityCheckpointType } from '../types';

const TERMINAL_CHECKPOINT_TYPES: ReadonlySet<string> = new Set([
  ActivityCheckpointType.Completed,
  ActivityCheckpointType.Failed,
]);

/**
 * Reports whether a checkpoint type ends its run. Takes the raw type rather than a checkpoint, so a
 * caller validating an untrusted payload tests it without narrowing to the enum first.
 */
export function isTerminalCheckpointType(type: string): boolean {
  return TERMINAL_CHECKPOINT_TYPES.has(type);
}
