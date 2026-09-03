import type { UndeliveredWork } from '../worker/worker-contract';
import type { QueuedCheckpoint } from './types';

interface BuildUndeliveredWorkInput {
  readonly checkpoints: ReadonlyArray<QueuedCheckpoint>;
  readonly runningActivityID: null | string;
  readonly startIDs: ReadonlyArray<string>;
}

export function buildUndeliveredWork(input: Readonly<BuildUndeliveredWorkInput>): UndeliveredWork {
  const activityIDs = new Set(input.startIDs);
  const spans = new Map<string, { max: number; min: number }>();

  for (const checkpoint of input.checkpoints) {
    activityIDs.add(checkpoint.activityID);

    const span = spans.get(checkpoint.activityID);
    const time = checkpoint.payload.time;

    if (span === undefined) {
      spans.set(checkpoint.activityID, { max: time, min: time });
      continue;
    }

    span.max = Math.max(span.max, time);
    span.min = Math.min(span.min, time);
  }

  if (input.runningActivityID !== null) {
    activityIDs.add(input.runningActivityID);
  }

  let playMs = 0;

  for (const span of spans.values()) {
    playMs += span.max - span.min;
  }

  return { activityCount: activityIDs.size, playMs };
}
