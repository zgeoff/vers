/**
 * Distinct draw channels for a single cell, so independent decisions (x jitter, y jitter, biome
 * geometry) read from uncorrelated streams rather than reusing one hash. The biome channels form
 * their own domain, independent from placement's jitter channels, so terrain geometry and node
 * placement never correlate.
 *
 * The procgen render domains (`scatterProps` through `reliefFine`) each reserve a numeric block
 * starting at their listed channel: a consumer offsets from the block's base by a per-draw salt (an
 * instance index times a fixed stride, plus a local field index) to decorrelate every part of one
 * assembly. Each block reserves 10000 channels before the next domain's base — an upper bound well
 * past any per-cell draw count, since the heaviest domain places a few dozen instances at a
 * per-instance stride under 100, so a domain may grow its draw count without auditing its
 * neighbours. `reliefCoarse`/`reliefFine` are the one exception: relief samples a value-noise field
 * directly on those two channels with no further offsetting.
 */
export const HASH_CHANNEL = {
  jitterX: 0,
  jitterY: 1,
  worleyFeatureX: 2,
  worleyFeatureY: 3,
  biomeDraw: 4,
  modifierFeatureX: 5,
  modifierFeatureY: 6,
  modifierDraw: 7,
  wobbleX: 8,
  wobbleY: 9,

  /**
   * Block base for ambient wilderness scatter — clustered props and their placement draws.
   */
  scatterProps: 10_000,

  /**
   * Block base for deliberate per-node structure assemblies, archetype-drawn per node.
   */
  nodeStructures: 20_000,

  /**
   * Block base for per-edge road furniture (lamps, gates, masts, waymarkers) and viaduct decks.
   */
  edgeFurniture: 30_000,

  /**
   * Block base for rare cluster-independent landmark assemblies and their light pillars.
   */
  landmarks: 40_000,

  /**
   * Block base for rare fallen-giant assemblies (toppled column trains).
   */
  fallenGiants: 50_000,

  /**
   * Block base for high-count ground-layer debris (shards, chips, stubs).
   */
  debris: 60_000,

  /**
   * Coarse-frequency octave of the terrain relief heightfield.
   */
  reliefCoarse: 70_000,

  /**
   * Fine-frequency octave of the terrain relief heightfield.
   */
  reliefFine: 70_001,
} as const;

/**
 * Stateless Squirrel3-style integer hash of a cell coordinate and draw channel under an avatar's
 * seed. Deterministic and neighbour-free: a cell's value computes straight from its coordinates, so
 * regions generate in any order without touching each other. Returns a uint32.
 */
export function buildCoordHash(userSeed: number, cx: number, cy: number, channel: number): number {
  const combined = toInt32(
    cx + Math.imul(cy, COORD_PRIME_Y) + Math.imul(channel, COORD_PRIME_CHANNEL),
  );

  return buildSquirrelNoise(combined, toUint32(userSeed));
}

/**
 * `buildCoordHash` mapped into the half-open unit interval `[0, 1)`, the form jitter and threshold
 * draws consume.
 */
export function buildCoordHashUnit(
  userSeed: number,
  cx: number,
  cy: number,
  channel: number,
): number {
  return buildCoordHash(userSeed, cx, cy, channel) / UINT32_RANGE;
}

const COORD_PRIME_Y = 198_491_317;
const COORD_PRIME_CHANNEL = 6_542_989;
const UINT32_RANGE = 2 ** 32;
const NOISE_1 = 0xb5297a4d;
const NOISE_2 = 0x68e31da4;
const NOISE_3 = 0x1b56c4e9;

/**
 * Squirrel3 bit-mixing avalanche: one 32-bit input plus a seed to a well-distributed uint32.
 */
function buildSquirrelNoise(n: number, seed: number): number {
  let mixed = Math.imul(n, NOISE_1);

  mixed = toInt32(mixed + seed);
  mixed ^= mixed >>> 8;
  mixed = toInt32(mixed + NOISE_2);
  mixed ^= mixed << 8;
  mixed = Math.imul(mixed, NOISE_3);
  mixed ^= mixed >>> 8;

  return toUint32(mixed);
}

/**
 * Reinterprets a number as a signed 32-bit int, wrapping overflow the way the mixing steps rely on.
 */
function toInt32(n: number): number {
  // oxlint-disable-next-line unicorn/prefer-math-trunc -- bitwise or wraps to a signed 32-bit int; Math.trunc only drops a fractional part, it never wraps
  return n | 0;
}

/**
 * Reinterprets a signed 32-bit int as its unsigned value.
 */
function toUint32(n: number): number {
  // oxlint-disable-next-line unicorn/prefer-math-trunc -- unsigned shift reinterprets the sign bit as magnitude; Math.trunc cannot clear it
  return n >>> 0;
}
