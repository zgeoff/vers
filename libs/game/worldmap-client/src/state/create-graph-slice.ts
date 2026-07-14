import type { WorldGraph } from '@vers/worldmap-core';

export interface GraphSlice {
  worldGraph: WorldGraph;
}

export function createGraphSlice(): GraphSlice {
  return {
    worldGraph: { edges: {}, nodes: {} },
  };
}
