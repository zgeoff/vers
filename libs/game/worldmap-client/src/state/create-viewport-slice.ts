import type { Viewport } from '@vers/worldmap-core';

export interface ViewportSlice {
  viewport: null | Viewport;
}

export function createViewportSlice(): ViewportSlice {
  return {
    viewport: null,
  };
}
