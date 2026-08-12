import type { RevealSource } from '@vers/worldmap-core';

export interface RevealSlice {
  revealSources: null | ReadonlyArray<RevealSource>;
}

export function createRevealSlice(): RevealSlice {
  return {
    revealSources: null,
  };
}
