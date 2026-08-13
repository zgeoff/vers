import { useWorldmapStore } from './use-worldmap-store';

export function useUserSeed() {
  return useWorldmapStore((state) => state.userSeed);
}
