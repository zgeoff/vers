import { create } from 'zustand';
import type { SatelliteEntry } from './types';

interface SatelliteStoreState {
  readonly satellites: ReadonlyMap<string, SatelliteEntry>;
}

export const useSatelliteStore = create<SatelliteStoreState>(() => ({
  satellites: new Map(),
}));
