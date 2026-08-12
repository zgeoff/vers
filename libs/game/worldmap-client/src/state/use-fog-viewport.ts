import { useShallow } from 'zustand/react/shallow';
import { buildChunkAlignedViewport } from '../utils/build-chunk-aligned-viewport';
import { useWorldmapStore } from './use-worldmap-store';

/**
 * The chunk-aligned viewport the fog projection rebuilds from. Shallow equality keeps the returned
 * reference stable across the cell-granular viewport writes a camera pan produces, so fog
 * consumers re-render only when the pan crosses a chunk boundary.
 */
export function useFogViewport() {
  return useWorldmapStore(
    useShallow((state) =>
      state.viewport === null ? null : buildChunkAlignedViewport(state.viewport),
    ),
  );
}
