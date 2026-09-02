import { useSatelliteStore } from './use-satellite-store';

export function removeSatellite(id: string): void {
  useSatelliteStore.setState((state) => {
    if (!state.satellites.has(id)) {
      return state;
    }

    const satellites = new Map(state.satellites);

    satellites.delete(id);

    return { satellites };
  });
}
