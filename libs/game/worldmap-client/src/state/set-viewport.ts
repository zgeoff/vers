import type { Viewport } from '@vers/worldmap-core';
import { useWorldmapStore } from './use-worldmap-store';

export function setViewport(viewport: Viewport) {
  useWorldmapStore.setState({ viewport });
}
