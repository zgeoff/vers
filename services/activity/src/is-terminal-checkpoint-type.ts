/**
 * Reports whether a checkpoint type ends its run. A terminal checkpoint claims the activity's
 * terminal transition and carries the run's final earned xp rather than one checkpoint's delta, so
 * a stored stream holds at most one of them, at its head.
 */
export function isTerminalCheckpointType(type: string): boolean {
  return type === 'completed' || type === 'failed';
}
