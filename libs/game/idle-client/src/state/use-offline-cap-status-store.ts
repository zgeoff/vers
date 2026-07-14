import { create } from 'zustand';
import type { OfflineCapStatus } from '../types';

interface OfflineCapStatusStore {
  offlineCapStatus: null | OfflineCapStatus;
}

export const useOfflineCapStatusStore = create<OfflineCapStatusStore>()(() => ({
  offlineCapStatus: null,
}));
