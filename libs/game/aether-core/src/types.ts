export interface AetherGraph {
  readonly edges: AetherEdgeMap;
  readonly nodes: AetherNodeMap;
}

export type AetherEdgeMap = Readonly<Record<string, AetherEdge>>;

export type AetherNodeMap = Readonly<Record<string, AetherNode>>;

export interface AetherNode {
  readonly connections: readonly [null | string, null | string, null | string, null | string];
  readonly difficulty: number;
  readonly id: string;
  readonly index: number;
  readonly position: readonly [number, number];
  readonly seed: number;
}

export interface AetherEdge {
  readonly end: readonly [number, number];
  readonly id: string;
  readonly start: readonly [number, number];
}

export interface CompressedAetherNode {
  readonly c: readonly [null | string, null | string, null | string, null | string];
  readonly d: number;
  readonly i: number;
  readonly id: string;
  readonly p: readonly [number, number];
  readonly s: number;
}
