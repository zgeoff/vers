import type { AvatarData } from '@vers/contract-avatar';

interface ActiveAvatarSource {
  readonly activeAvatarID: null | string;
  readonly avatars: ReadonlyArray<AvatarData>;
}

export function findActiveAvatar(roster: ActiveAvatarSource): AvatarData | null {
  return roster.avatars.find((avatar) => avatar.id === roster.activeAvatarID) ?? null;
}
