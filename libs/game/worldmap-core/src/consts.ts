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

/**
 * Bits per axis packed into a Morton key. 26 bits per axis keeps the interleaved result within 52
 * of `Number.MAX_SAFE_INTEGER`'s 53 mantissa bits, while supporting a zigzag-encoded coordinate
 * magnitude up to about 33.5 million cells from origin in either direction on each axis — far past
 * any distance actually reachable.
 */
export const MORTON_AXIS_BITS = 26;

/**
 * Hex-hop radius the reveal projection discloses around each verified first-clear node. The design
 * band is 2 to 5 hops, and 5 is a security bound rather than a tuning preference: look-ahead value
 * and the map-scanning exploit's return both climb with the radius, so a value approaching that
 * bound trades security margin for reveal depth.
 */
export const REVEAL_RADIUS = 2;
