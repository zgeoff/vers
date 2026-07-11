import { useDevStore } from './use-dev-store';

export function useIsAxesHelperVisible() {
  const isAxesHelperVisible = useDevStore((state) => state.isAxesHelperVisible);

  return isAxesHelperVisible;
}
