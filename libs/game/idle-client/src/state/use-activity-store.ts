import type { ActivityAppState } from '@vers/idle-core';
import { create } from 'zustand';

interface ActivityStore {
  activity: ActivityAppState | null;
}

export const useActivityStore = create<ActivityStore>()(() => ({
  activity: null,
}));
