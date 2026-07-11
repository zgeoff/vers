import type { SatelliteEntry } from './types';
import { useSatelliteStore } from './use-satellite-store';

/**
 * Registers a satellite element under `id`, replacing any existing entry registered under the
 * same id.
 */
export function registerSatellite(id: string, entry: Readonly<SatelliteEntry>): void {
  useSatelliteStore.setState((state) => ({
    satellites: new Map(state.satellites).set(id, entry),
  }));
}
