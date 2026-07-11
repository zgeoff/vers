import { useDevStore } from './use-dev-store';

export function toggleAxesHelper() {
  useDevStore.setState((state) => ({
    isAxesHelperVisible: !state.isAxesHelperVisible,
  }));
}
