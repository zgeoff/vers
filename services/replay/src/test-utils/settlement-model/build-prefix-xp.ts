import { isTerminalCheckpointType } from '@vers/idle-core';
import type { ModelCheckpoint } from './types';

export function buildPrefixXP(checkpoints: ReadonlyArray<ModelCheckpoint>, head: number): number {
  const prefix = checkpoints.slice(0, head);
  const last = prefix.at(-1);

  if (last !== undefined && isTerminalCheckpointType(last.type)) {
    return last.xp;
  }

  return prefix.reduce((total, checkpoint) => total + checkpoint.xp, 0);
}
