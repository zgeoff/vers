import type { WorldGraph } from '../types';

export interface GraphSlice {
  regionKey: null | string;
  selectableNodeIDs: ReadonlySet<string>;
  userSeed: null | number;
  worldGraph: WorldGraph;
}

export function createGraphSlice(): GraphSlice {
  return {
    regionKey: null,
    selectableNodeIDs: new Set(),
    userSeed: null,
    worldGraph: { edges: {}, nodes: {} },
  };
}
