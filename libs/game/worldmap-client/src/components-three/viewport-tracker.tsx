import { useFrame } from '@react-three/fiber';
import type { Viewport } from '@vers/worldmap-core';
import { setViewport } from '../state/set-viewport';
import { useWorldmapStore } from '../state/use-worldmap-store';
import { buildViewportFromCamera } from '../utils/build-viewport-from-camera';

/**
 * Keeps the store's viewport in step with the gameplay camera's ground footprint. Reads and writes
 * go through `getState()`/`setViewport` rather than a subscribed selector, so a camera move that
 * doesn't cross a cell boundary costs no re-render — `buildViewportFromCamera`'s cell-granular
 * rounding is what throttles the write to once per boundary crossing instead of once per frame.
 */
export function ViewportTracker() {
  useFrame(() => {
    const camera = useWorldmapStore.getState().camera;

    if (!camera) {
      return;
    }

    const nextViewport = buildViewportFromCamera(camera);

    if (!nextViewport || isSameViewport(useWorldmapStore.getState().viewport, nextViewport)) {
      return;
    }

    setViewport(nextViewport);
  });

  return null;
}

function isSameViewport(previous: null | Viewport, next: Viewport): boolean {
  return (
    previous !== null &&
    previous.minCX === next.minCX &&
    previous.maxCX === next.maxCX &&
    previous.minCY === next.minCY &&
    previous.maxCY === next.maxCY
  );
}
