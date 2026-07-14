import { useWorldmapStore } from './use-worldmap-store';

export function toggleAxesHelper() {
  useWorldmapStore.setState((state) => ({
    isAxesHelperVisible: !state.isAxesHelperVisible,
  }));
}
