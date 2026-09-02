import { useFrame } from '@react-three/fiber';
import type { Viewport } from '@vers/worldmap-core';
import { setViewport } from '../state/set-viewport';
import { useWorldmapStore } from '../state/use-worldmap-store';
import { buildViewportFromCamera } from '../utils/build-viewport-from-camera';

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
