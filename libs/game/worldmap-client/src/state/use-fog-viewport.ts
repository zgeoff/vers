import { useShallow } from 'zustand/react/shallow';
import { buildChunkAlignedViewport } from '../utils/build-chunk-aligned-viewport';
import { useWorldmapStore } from './use-worldmap-store';

export function useFogViewport() {
  return useWorldmapStore(
    useShallow((state) =>
      state.viewport === null ? null : buildChunkAlignedViewport(state.viewport),
    ),
  );
}
