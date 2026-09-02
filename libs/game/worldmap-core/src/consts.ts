import type { BiomeRosterEntry } from './types';

export const CHUNK_SIZE = 16;
export const HEX_SIZE = 1;
export const JITTER = 0.4;
export const EDGE_DISTANCE_CAP = 2.9;
export const DIFFICULTY_STEP = 1;
export const MAX_DIFFICULTY = 100;
export const ORIGIN_CELL: readonly [number, number] = [0, 0];
export const MORTON_AXIS_BITS = 26;
export const WORLD_COORD_MIN = -(2 ** (MORTON_AXIS_BITS - 1));
export const WORLD_COORD_MAX = 2 ** (MORTON_AXIS_BITS - 1) - 1;
export const REVEAL_RADIUS = 2;
export const BIOME_PATCH_SIZE = 6;
export const MODIFIER_PATCH_SIZE = 18;
export const BIOME_EDGE_WOBBLE_AMPLITUDE = 0;
export const BIOME_EDGE_WOBBLE_FREQUENCY = 0.25;
export const BIOME_BLEND_BAND = 1;
export const BIOME_TERRITORY_BLEND_BAND = 0.75;

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

export const MODIFIER_ROSTER: ReadonlyArray<BiomeRosterEntry> = [
  { id: 0, name: 'none', weights: [[0, 9]] },
  { id: 1, name: 'modifier_1', weights: [[0, 1]] },
];
