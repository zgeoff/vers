import type { WorldGraph } from '../types';

export interface GraphSlice {
  regionKey: null | string;
  worldGraph: WorldGraph;
}

export function createGraphSlice(): GraphSlice {
  return {
    regionKey: null,
    worldGraph: { edges: {}, nodes: {} },
  };
}
