import { create } from 'zustand';

interface NavigationStore {
  visible: boolean;
}

export const useNavigationStore = create<NavigationStore>()(() => ({
  visible: false,
}));
