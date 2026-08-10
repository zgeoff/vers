/**
 * A canonical cell-coordinate node id, `"cx_cy"`. Stable across regenerations and referenceable from
 * the database — an avatar's seed varies what a cell holds and which edges leave it, never that the
 * cell exists or what its id is.
 */
export type CanonicalID = string;

/**
 * A node on the hex lattice. Identity is its cell coordinate; `position` is the cell center after
 * per-avatar jitter, in unit-hex scene coordinates. Content lives on the sealed server plane and is
 * never carried here.
 */
export interface WorldMapNode {
  readonly coord: readonly [number, number];
  readonly difficulty: number;
  readonly id: CanonicalID;
  readonly position: readonly [number, number];
}

/**
 * An undirected connection between two nodes. `id` is the two endpoint ids in ascending order joined
 * by `|`, so the same edge derived from either endpoint carries one identity.
 */
export interface WorldEdge {
  readonly end: readonly [number, number];
  readonly id: string;
  readonly start: readonly [number, number];
}

/**
 * One origin the reveal projection discloses a disc around — a verified first-clear node in
 * production, any coordinate in a test. Generic over what grants it: the projection folds a list of
 * these into the revealed region without knowing where they came from.
 */
export interface RevealSource {
  readonly coord: readonly [number, number];
  readonly radius: number;
}

/**
 * The rectangular cell-coordinate range a reveal query bounds its answer to. The viewport limits
 * what a query returns, never what the underlying discs make eligible to disclose.
 */
export interface Viewport {
  readonly maxCX: number;
  readonly maxCY: number;
  readonly minCX: number;
  readonly minCY: number;
}

/**
 * Morton-packed cell keys a reveal query discloses, ascending by key — the sort order that keeps
 * spatially near cells near each other in the array. The matching Morton decoder recovers each
 * entry's cell coordinate.
 */
export type RevealedCells = ReadonlyArray<number>;
