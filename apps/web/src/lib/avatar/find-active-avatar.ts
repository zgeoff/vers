import type { AvatarData } from '@vers/contract-avatar';

/**
 * The app's one active-avatar rule: the caller's first avatar, or null with none. Every reader —
 * query select and loader alike — routes through here, the single place the rule changes once an
 * account can hold more than one avatar.
 */
export function findActiveAvatar(avatars: ReadonlyArray<AvatarData>): AvatarData | null {
  return avatars[0] ?? null;
}
