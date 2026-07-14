import { useIdleStore } from './use-idle-store';

export function useFailureAction() {
  return useIdleStore((state) => state.failureAction);
}
