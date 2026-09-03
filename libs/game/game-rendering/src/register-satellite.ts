import type { SatelliteEntry } from './types';
import { useSatelliteStore } from './use-satellite-store';

export function registerSatellite(id: string, entry: Readonly<SatelliteEntry>): void {
  useSatelliteStore.setState((state) => ({
    satellites: new Map(state.satellites).set(id, entry),
  }));
}
