import { useNavigationStore } from './use-navigation-store';

export function useNavigationVisible(): boolean {
  return useNavigationStore((state) => state.visible);
}
