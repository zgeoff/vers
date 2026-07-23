import type { AvatarData } from '@vers/contract-avatar';
import type { PendingStartIntent } from '@vers/idle-client';
import type { ActivitySnapshot, AvatarSnapshot } from '@vers/idle-core';

/**
 * The avatar the roster must treat as currently out, identifying enough to name it in a rejection
 * message.
 */
export interface OngoingRunOwner {
  readonly id: string;
  readonly name: string;
}

/**
 * Finds the avatar the idle worker's own state says is mid-run, ahead of any server round trip. A
 * running activity is the liveness signal — its paired avatar snapshot names the owner — because the
 * avatar snapshot alone lingers a frame past a run's end and would wrongly read as still out. Absent
 * a live activity, a parked continuation-start intent names the avatar the worker meant to resume
 * across the gap between run segments. `null` when neither holds, meaning no avatar is known to be
 * out.
 */
export function findOngoingRunOwner(
  activity: Readonly<ActivitySnapshot> | undefined,
  liveAvatar: Readonly<AvatarSnapshot> | undefined,
  pendingIntent: Readonly<PendingStartIntent> | undefined,
  avatars: ReadonlyArray<AvatarData>,
): OngoingRunOwner | null {
  if (activity !== undefined && liveAvatar !== undefined) {
    return { id: liveAvatar.id, name: liveAvatar.name };
  }

  if (pendingIntent !== undefined) {
    const owner = avatars.find((avatar) => avatar.id === pendingIntent.avatarID);

    return owner === undefined ? null : { id: owner.id, name: owner.name };
  }

  return null;
}
