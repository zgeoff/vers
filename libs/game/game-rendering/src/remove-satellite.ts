import { useSatelliteStore } from './use-satellite-store';

/**
 * Removes the satellite entry registered under `id`, if one exists.
 */
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
