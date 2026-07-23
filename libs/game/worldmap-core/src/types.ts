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

/**
 * A canonical cell-coordinate node id, `"cx,cy"`. Stable across regenerations and referenceable from
 * the database — an avatar's seed varies what a cell holds and which edges leave it, never that the
 * cell exists or what its id is.
 */
export type CanonicalID = string;

/**
 * A node on the hex lattice. Identity is its cell coordinate; `position` is the cell center after
 * per-avatar jitter, in unit-hex scene coordinates. Content lives on the sealed server plane and is
 * never carried here.
 */
export interface LatticeNode {
  readonly coord: readonly [number, number];
  readonly difficulty: number;
  readonly id: CanonicalID;
  readonly position: readonly [number, number];
}

/**
 * An undirected connection between two lattice nodes. `id` is the two endpoint ids in ascending
 * order joined by `|`, so the same edge derived from either endpoint carries one identity.
 */
export interface LatticeEdge {
  readonly end: readonly [number, number];
  readonly id: string;
  readonly start: readonly [number, number];
}
