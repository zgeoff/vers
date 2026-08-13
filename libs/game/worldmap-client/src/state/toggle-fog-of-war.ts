import { useWorldmapStore } from './use-worldmap-store';

export function toggleFogOfWar() {
  useWorldmapStore.setState((state) => ({
    isFogOfWarVisible: !state.isFogOfWarVisible,
  }));
}
