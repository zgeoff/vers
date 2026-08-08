import type { WorldGraph } from '../types';

export interface GraphSlice {
  worldGraph: WorldGraph;
}

export function createGraphSlice(): GraphSlice {
  return {
    worldGraph: { edges: {}, nodes: {} },
  };
}
