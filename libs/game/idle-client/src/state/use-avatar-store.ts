import type { AvatarAppState } from '@vers/idle-core';
import { create } from 'zustand';

interface AvatarStore {
  avatar: AvatarAppState | null;
}

export const useAvatarStore = create<AvatarStore>()(() => ({
  avatar: null,
}));
