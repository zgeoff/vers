import { create } from 'zustand';

export interface NavigationStore {
  visible: boolean;
}

export const useNavigationStore = create<NavigationStore>()(() => ({
  visible: false,
}));
