export interface WorldGraph {
  readonly edges: WorldEdgesByID;
  readonly nodes: WorldMapNodesByID;
}

export type WorldEdgesByID = Readonly<Record<string, WorldEdge>>;

export type WorldMapNodesByID = Readonly<Record<string, WorldMapNode>>;

export interface WorldMapNode {
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

export interface CompressedWorldMapNode {
  readonly c: readonly [null | string, null | string, null | string, null | string];
  readonly d: number;
  readonly i: number;
  readonly id: string;
  readonly p: readonly [number, number];
  readonly s: number;
}
