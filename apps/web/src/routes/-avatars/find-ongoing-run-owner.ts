import type { AvatarData } from '@vers/contract-avatar';
import type { PendingStartIntent } from '@vers/idle-client';
import type { AvatarSnapshot } from '@vers/idle-core';

/**
 * The avatar the roster must treat as currently out, identifying enough to name it in a rejection
 * message.
 */
export interface OngoingRunOwner {
  readonly id: string;
  readonly name: string;
}

/**
 * Finds the avatar the idle worker's own state says is mid-run, ahead of any server round trip: a
 * live simulation snapshot takes precedence, since it reflects the running sim directly; absent
 * that, a parked continuation-start intent names the avatar the worker meant to resume. `null` when
 * neither is present, meaning no avatar is known to be out.
 */
export function findOngoingRunOwner(
  liveAvatar: Readonly<AvatarSnapshot> | undefined,
  pendingIntent: Readonly<PendingStartIntent> | undefined,
  avatars: ReadonlyArray<AvatarData>,
): OngoingRunOwner | null {
  if (liveAvatar !== undefined) {
    return { id: liveAvatar.id, name: liveAvatar.name };
  }

  if (pendingIntent !== undefined) {
    const owner = avatars.find((avatar) => avatar.id === pendingIntent.avatarID);

    return owner === undefined ? null : { id: owner.id, name: owner.name };
  }

  return null;
}
