import type { BiomeRosterEntry } from './types';

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
// SPIKE: pushed past the 0.22 bound that kept ring-exclusivity provable; the Gabriel witness test
// now prunes second-ring edges instead of the distance cap
export const JITTER = 0.4;

/**
 * Two nodes connect only when their jittered centers fall within this distance. Set above the
 * maximum jittered nearest-neighbour distance so every minimum-spanning-tree edge survives, and
 * below the nearest second-ring distance so only the six adjacent cells are ever candidates — the
 * bound that keeps the Gabriel backbone connected.
 */
// SPIKE: widened to cover the worst jittered nearest-neighbour stretch (1.732 + 2√2·0.4 ≈ 2.86)
export const EDGE_DISTANCE_CAP = 2.9;

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
 * Lowest cell coordinate a Morton key can pack on either axis. Zigzag encoding spends one of the
 * per-axis bits on sign, so the negative half reaches one step further from origin than the positive
 * half.
 */
export const WORLD_COORD_MIN = -(2 ** (MORTON_AXIS_BITS - 1));

/**
 * Highest cell coordinate a Morton key can pack on either axis.
 */
export const WORLD_COORD_MAX = 2 ** (MORTON_AXIS_BITS - 1) - 1;

/**
 * Hex-hop radius the reveal projection discloses around each verified first-clear node. The design
 * band is 2 to 5 hops, and 5 is a security bound rather than a tuning preference: look-ahead value
 * and the map-scanning exploit's return both climb with the radius, so a value approaching that
 * bound trades security margin for reveal depth.
 */
export const REVEAL_RADIUS = 2;

/**
 * Side length, in scene units, of a coarse Worley grid cell the base-biome layer scatters one
 * feature point per cell into. Targets patches roughly 4 to 8 hexes across.
 */
export const BIOME_PATCH_SIZE = 6;

/**
 * Side length, in scene units, of the coarse Worley grid the modifier layer scatters its feature
 * points into. Spans several base-biome patches, so a modifier overlay reads as a rarer, broader
 * variation layered on top of the base terrain.
 */
export const MODIFIER_PATCH_SIZE = 18;

/**
 * Peak per-axis offset the edge-wobble domain warp displaces a sample position by, in scene units.
 * Keeps patch borders from reading as straight Worley-cell edges.
 */
export const BIOME_EDGE_WOBBLE_AMPLITUDE = 0;

/**
 * Spatial frequency, in inverse scene units, the edge-wobble value-noise field is sampled at.
 * Higher wobbles the border on a shorter wavelength.
 */
export const BIOME_EDGE_WOBBLE_FREQUENCY = 0.25;

/**
 * Scene-unit width of the border blend zone around a Worley cell boundary: `blendT` ramps from 0 to
 * 1 over this span of nearest/second-nearest distance difference.
 */
export const BIOME_BLEND_BAND = 1;

/**
 * Scene-unit width of the tint crossfade along a territory border in the rendered biome field:
 * a texel's `blendT` ramps from 0 to 1 as its nearest and second-nearest nodes' distances converge
 * across this span, and only where the two nodes wear different biomes.
 */
export const BIOME_TERRITORY_BLEND_BAND = 0.75;

/**
 * Base-biome alternatives and their distance-banded rarity, placeholder and tunable. Every name is
 * dev-facing flavour text — it must never reach a contract schema, an analytics event, or a DB
 * column. `biome_1` is common at every distance; `biome_2` is absent until distance ~20 and fades
 * in by ~80; `biome_3` is deep-only, absent until distance ~60 and fading in by ~140; `biome_4` is
 * common near the origin and rarer far out. Every curve converges to a roughly equal weight by
 * distance 200.
 */
export const BIOME_ROSTER: ReadonlyArray<BiomeRosterEntry> = [
  {
    id: 0,
    name: 'biome_1',
    weights: [
      [0, 2],
      [200, 1],
    ],
  },
  {
    id: 1,
    name: 'biome_2',
    weights: [
      [0, 0],
      [20, 0],
      [80, 1],
      [200, 1],
    ],
  },
  {
    id: 2,
    name: 'biome_3',
    weights: [
      [0, 0],
      [60, 0],
      [140, 1],
      [200, 1],
    ],
  },
  {
    id: 3,
    name: 'biome_4',
    weights: [
      [0, 4],
      [100, 1.5],
      [200, 1],
    ],
  },
];

/**
 * Modifier alternatives layered over the base biome: `none` dominates every draw, `modifier_1` is a
 * rare overlay. Flat weights — no distance banding for modifiers yet.
 */
export const MODIFIER_ROSTER: ReadonlyArray<BiomeRosterEntry> = [
  { id: 0, name: 'none', weights: [[0, 9]] },
  { id: 1, name: 'modifier_1', weights: [[0, 1]] },
];
