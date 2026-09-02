import { ActivityCheckpointType } from '../types';

const TERMINAL_CHECKPOINT_TYPES: ReadonlySet<string> = new Set([
  ActivityCheckpointType.Completed,
  ActivityCheckpointType.Failed,
]);

export function isTerminalCheckpointType(type: string): boolean {
  return TERMINAL_CHECKPOINT_TYPES.has(type);
}
