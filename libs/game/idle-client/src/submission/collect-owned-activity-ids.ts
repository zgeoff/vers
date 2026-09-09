import type { ActivityData } from '@vers/contract-activity';
import type { QueuedCheckpoint } from './types';

interface CollectOwnedActivityIDsInput {
  readonly avatarIDs: ReadonlyArray<string>;
  readonly checkpoints: ReadonlyArray<QueuedCheckpoint>;
  readonly starts: ReadonlyArray<ActivityData>;
}

export function collectOwnedActivityIDs(
  input: Readonly<CollectOwnedActivityIDsInput>,
): ReadonlySet<string> {
  const avatarIDs = new Set(input.avatarIDs);
  const pendingStartIDs = new Set(input.starts.map((start) => start.id));
  const owned = new Set<string>();

  for (const start of input.starts) {
    if (avatarIDs.has(start.avatarID)) {
      owned.add(start.id);
    }
  }

  // a checkpoint names no avatar: one queued behind an activity start on this device belongs with
  // that start, and one whose start the server already admitted has no owner the device can read
  for (const checkpoint of input.checkpoints) {
    if (!pendingStartIDs.has(checkpoint.activityID)) {
      owned.add(checkpoint.activityID);
    }
  }

  return owned;
}
