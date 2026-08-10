import type { WorldGraph } from '../types';

export interface GraphSlice {
  worldGraph: WorldGraph;
  worldSeed: null | number;
}

export function createGraphSlice(): GraphSlice {
  return {
    worldGraph: { edges: {}, nodes: {} },
    worldSeed: null,
  };
}
