export function isTerminalCheckpointType(type: string): boolean {
  return type === 'completed' || type === 'failed';
}
