import type { ActivityData } from '@vers/contract-activity';
import type { NodeSeedAnchor, PendingStopIntent, QueuedCheckpoint } from './types';

interface IsStaleChainHeadFinalInput {
  readonly anchor: NodeSeedAnchor;
  readonly checkpoints: ReadonlyArray<QueuedCheckpoint>;
  readonly row: ActivityData;
  readonly starts: ReadonlyArray<ActivityData>;
  readonly stopIntent: PendingStopIntent | undefined;
}

export function isStaleChainHeadFinal(input: Readonly<IsStaleChainHeadFinalInput>): boolean {
  // undelivered work only ever moves the server's anchor forward, so an anchor at or past the
  // start's index never comes back to it
  if (input.anchor.chainIndex >= input.row.startChainIndex) {
    return true;
  }

  return !hasEarlierWorkPending(input);
}

function hasEarlierWorkPending(input: Readonly<IsStaleChainHeadFinalInput>): boolean {
  const row = input.row;

  const startsByID = new Map(input.starts.map((start) => [start.id, start]));

  // a queued checkpoint with no pending start belongs to an admitted activity, which names no scope
  // on this device, so it may still forward-exit on this chain
  const admittedWorkPending = input.checkpoints.some(
    (checkpoint) => checkpoint.activityID !== row.id && !startsByID.has(checkpoint.activityID),
  );

  const stopPending =
    input.stopIntent !== undefined &&
    input.stopIntent.avatarID === row.avatarID &&
    input.stopIntent.activityID !== row.id;

  return admittedWorkPending || stopPending || hasPendingAncestorOnChain(row, startsByID);
}

function hasPendingAncestorOnChain(
  row: Readonly<ActivityData>,
  startsByID: ReadonlyMap<string, ActivityData>,
): boolean {
  const visited = new Set([row.id]);

  let ancestor =
    row.predecessorActivityID === null ? undefined : startsByID.get(row.predecessorActivityID);

  while (ancestor !== undefined && !visited.has(ancestor.id)) {
    if (ancestor.scopeType === row.scopeType && ancestor.scopeID === row.scopeID) {
      return true;
    }

    visited.add(ancestor.id);

    ancestor =
      ancestor.predecessorActivityID === null
        ? undefined
        : startsByID.get(ancestor.predecessorActivityID);
  }

  return false;
}
