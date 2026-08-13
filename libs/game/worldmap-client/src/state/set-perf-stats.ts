import type { PerfStats } from '../types';
import { useWorldmapStore } from './use-worldmap-store';

export function setPerfStats(perfStats: PerfStats) {
  useWorldmapStore.setState({ perfStats });
}
