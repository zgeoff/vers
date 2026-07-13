import type { AvatarSnapshot } from '@vers/idle-core';
import { useAvatarStore } from './use-avatar-store';

export function setAvatar(avatar?: AvatarSnapshot) {
  useAvatarStore.setState(() => ({ avatar: avatar ?? null }));
}
