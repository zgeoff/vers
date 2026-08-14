import type { PerfStats } from '../types';

export interface PerfSlice {
  perfStats: null | PerfStats;
}

export function createPerfSlice(): PerfSlice {
  return {
    perfStats: null,
  };
}
