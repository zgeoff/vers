import { useShallow } from 'zustand/react/shallow';
import { useActivityStore } from './use-activity-store';

export function useActivity() {
  const activity = useActivityStore(useShallow((state) => state.activity));

  return activity;
}
