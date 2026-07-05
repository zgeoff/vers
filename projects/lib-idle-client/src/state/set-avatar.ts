import type { AvatarAppState } from '@vers/idle-core';
import { useAvatarStore } from './use-avatar-store';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function setAvatar(avatar?: AvatarAppState) {
  useAvatarStore.setState(() => ({ avatar: avatar ?? null }));
}
