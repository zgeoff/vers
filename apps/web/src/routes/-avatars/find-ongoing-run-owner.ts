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
 * avatar snapshot alone lingers a frame past a run's end and would wrongly read as still out. The
 * signal holds across a run's whole chain: each attempt installs its successor locally, so no gap
 * between segments reads as idle. `null` when no avatar is known to be out.
 */
export function findOngoingRunOwner(
  activity: Readonly<ActivitySnapshot> | undefined,
  liveAvatar: Readonly<AvatarSnapshot> | undefined,
): OngoingRunOwner | null {
  if (activity !== undefined && liveAvatar !== undefined) {
    return { id: liveAvatar.id, name: liveAvatar.name };
  }

  return null;
}
