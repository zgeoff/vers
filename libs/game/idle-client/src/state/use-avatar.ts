import { useIdleStore } from './use-idle-store';

export function useAvatar() {
  return useIdleStore((state) => state.avatar);
}
