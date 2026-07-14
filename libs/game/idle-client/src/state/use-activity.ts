import { useIdleStore } from './use-idle-store';

export function useActivity() {
  return useIdleStore((state) => state.activity);
}
