import { create } from 'zustand';
import type { ResyncStatus } from '../types';

interface ResyncStatusStore {
  resyncStatus: null | ResyncStatus;
}

export const useResyncStatusStore = create<ResyncStatusStore>()(() => ({
  resyncStatus: null,
}));
