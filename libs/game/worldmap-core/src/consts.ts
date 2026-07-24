/**
 * Cells per side of a generation chunk — the unit a chunk is generated in, and the block a cell maps
 * back to.
 */
export const CHUNK_SIZE = 16;

/**
 * Pointy-top hex circumradius in scene units. One keeps the lattice at unit scale; downstream render
 * layers apply their own scene multiplier.
 */
export const HEX_SIZE = 1;

/**
 * Maximum per-axis position offset applied to a cell's center. Bounded below half the nearest-cell
 * spacing so a jittered node never leaves its own cell and the edge cap still clears every
 * nearest-neighbour pair.
 */
export const JITTER = 0.2;

/**
 * Two nodes connect only when their jittered centers fall within this distance. Set above the
 * maximum jittered nearest-neighbour distance so every minimum-spanning-tree edge survives, and
 * below the nearest second-ring distance so only the six adjacent cells are ever candidates — the
 * bound that keeps the Gabriel backbone connected.
 */
export const EDGE_DISTANCE_CAP = 2.35;

/**
 * Hex-distance span mapped to one difficulty step. Difficulty climbs one level every `DIFFICULTY_STEP`
 * rings out from the origin.
 */
export const DIFFICULTY_STEP = 1;

/**
 * Difficulty plateau. Distance runs unbounded past it; horizontal variety carries the world beyond.
 */
export const MAX_DIFFICULTY = 100;

/**
 * The home cell every avatar starts from and difficulty measures distance against.
 */
export const ORIGIN_CELL: readonly [number, number] = [0, 0];
