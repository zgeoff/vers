import type { WorldGraph } from '../types';

export interface GraphSlice {
  regionKey: null | string;
  selectableNodeIDs: ReadonlySet<string>;
  worldGraph: WorldGraph;
}

export function createGraphSlice(): GraphSlice {
  return {
    regionKey: null,
    selectableNodeIDs: new Set(),
    worldGraph: { edges: {}, nodes: {} },
  };
}
