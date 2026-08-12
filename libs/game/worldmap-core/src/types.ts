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

/**
 * Read-only structural view of a typed float array. A real `Float32Array` satisfies it directly,
 * and consumers typed against it stay deeply readonly — the typed array itself has no readonly
 * form.
 */
export interface ReadonlyFloatArray {
  readonly length: number;
  readonly [index: number]: number;
}

/**
 * A fog-density texel grid over a viewport, row-major with `cols * rows` samples: 0 over revealed
 * ground, easing up to 1 a falloff past the nearest reveal disc's edge.
 */
export interface RevealDistanceField {
  readonly cols: number;
  readonly rows: number;
  readonly values: ReadonlyFloatArray;
}

/**
 * Read-only structural view of a typed byte array. A real `Uint8Array` satisfies it directly, and
 * consumers typed against it stay deeply readonly — the typed array itself has no readonly form.
 */
export interface ReadonlyUint8Array {
  readonly length: number;
  readonly [index: number]: number;
}

/**
 * One roster alternative a biome or modifier draw can land on: a numeric id, a dev-facing
 * placeholder name that must never appear in a contract schema, analytics event, or DB column, and
 * a piecewise-linear weight-vs-hex-distance curve giving its distance-banded rarity. A curve's
 * points hold ascending distance; the weight holds flat before the first point and after the last.
 */
export interface BiomeRosterEntry {
  readonly id: number;
  readonly name: string;
  readonly weights: ReadonlyArray<readonly [distance: number, weight: number]>;
}

/**
 * The terrain-plane sample at one position: a base biome blended toward `neighbourBaseID` by
 * `blendT` near a patch border, plus an independent modifier layer. Pure flavour — every field is
 * public geometry, computed from `userSeed` and position alone.
 */
export interface BiomeSample {
  readonly baseID: number;
  readonly blendT: number;
  readonly modifierID: number;
  readonly neighbourBaseID: number;
}

/**
 * A biome texel grid over a viewport, row-major with `cols * rows` samples, laid out identically to
 * `RevealDistanceField` so a quad spanning the same viewport lines up with both.
 */
export interface BiomeField {
  readonly baseIDs: ReadonlyUint8Array;
  readonly blendTs: ReadonlyFloatArray;
  readonly cols: number;
  readonly modifierIDs: ReadonlyUint8Array;
  readonly neighbourBaseIDs: ReadonlyUint8Array;
  readonly rows: number;
}
