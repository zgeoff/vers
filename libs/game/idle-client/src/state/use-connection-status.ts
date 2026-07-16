import { useIdleStore } from './use-idle-store';

export function useConnectionStatus() {
  return useIdleStore((state) => state.connectionOnline);
}
