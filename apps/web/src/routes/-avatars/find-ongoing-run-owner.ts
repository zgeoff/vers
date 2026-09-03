import type { ActivitySnapshot, AvatarSnapshot } from '@vers/idle-core';

export interface OngoingRunOwner {
  readonly id: string;
  readonly name: string;
}

export function findOngoingRunOwner(
  activity: Readonly<ActivitySnapshot> | undefined,
  liveAvatar: Readonly<AvatarSnapshot> | undefined,
): OngoingRunOwner | null {
  if (activity !== undefined && liveAvatar !== undefined) {
    return { id: liveAvatar.id, name: liveAvatar.name };
  }

  return null;
}
