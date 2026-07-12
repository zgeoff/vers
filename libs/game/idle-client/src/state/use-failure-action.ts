import { useShallow } from 'zustand/react/shallow';
import { useFailureActionStore } from './use-failure-action-store';

export function useFailureAction() {
  const failureAction = useFailureActionStore(useShallow((state) => state.failureAction));

  return failureAction;
}
