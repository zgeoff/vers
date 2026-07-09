import type { AvatarAppState } from '@vers/idle-core';
import { useAvatarStore } from './use-avatar-store';

export function setAvatar(avatar?: AvatarAppState) {
  useAvatarStore.setState(() => ({ avatar: avatar ?? null }));
}
