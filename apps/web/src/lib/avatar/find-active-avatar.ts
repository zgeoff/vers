import type { AvatarData } from '@vers/contract-avatar';

interface ActiveAvatarSource {
  readonly activeAvatarID: null | string;
  readonly avatars: ReadonlyArray<AvatarData>;
}

/**
 * The app's one active-avatar rule: the roster's persisted selection resolved to its avatar, or
 * null when nothing is selected. Every reader — query select and loader alike — routes through
 * here.
 */
export function findActiveAvatar(roster: ActiveAvatarSource): AvatarData | null {
  return roster.avatars.find((avatar) => avatar.id === roster.activeAvatarID) ?? null;
}
