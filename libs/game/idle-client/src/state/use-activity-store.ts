import type { ActivitySnapshot } from '@vers/idle-core';
import { create } from 'zustand';

interface ActivityStore {
  activity: ActivitySnapshot | null;
}

export const useActivityStore = create<ActivityStore>()(() => ({
  activity: null,
}));
