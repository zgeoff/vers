import { useIdleStore } from './use-idle-store';

export function useSaveStatus() {
  return useIdleStore((state) => state.saveStatus);
}
