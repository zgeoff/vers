export interface WorldGraph {
  readonly edges: WorldEdgeMap;
  readonly nodes: WorldNodeMap;
}

export type WorldEdgeMap = Readonly<Record<string, WorldEdge>>;

export type WorldNodeMap = Readonly<Record<string, WorldNode>>;

export interface WorldNode {
  readonly connections: readonly [null | string, null | string, null | string, null | string];
  readonly difficulty: number;
  readonly id: string;
  readonly index: number;
  readonly position: readonly [number, number];
  readonly seed: number;
}

export interface WorldEdge {
  readonly end: readonly [number, number];
  readonly id: string;
  readonly start: readonly [number, number];
}

export interface CompressedWorldNode {
  readonly c: readonly [null | string, null | string, null | string, null | string];
  readonly d: number;
  readonly i: number;
  readonly id: string;
  readonly p: readonly [number, number];
  readonly s: number;
}
