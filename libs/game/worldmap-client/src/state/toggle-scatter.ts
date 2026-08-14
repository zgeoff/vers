import { useWorldmapStore } from './use-worldmap-store';

export function toggleScatter() {
  useWorldmapStore.setState((state) => ({
    isScatterVisible: !state.isScatterVisible,
  }));
}
