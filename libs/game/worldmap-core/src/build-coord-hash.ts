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

  scatterProps: 10_000,

  nodeStructures: 20_000,

  edgeFurniture: 30_000,

  landmarks: 40_000,

  fallenGiants: 50_000,

  debris: 60_000,

  reliefCoarse: 70_000,

  reliefFine: 70_001,
} as const;

export function buildCoordHash(userSeed: number, cx: number, cy: number, channel: number): number {
  const combined = toInt32(
    cx + Math.imul(cy, COORD_PRIME_Y) + Math.imul(channel, COORD_PRIME_CHANNEL),
  );

  return buildSquirrelNoise(combined, toUint32(userSeed));
}

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

function toInt32(n: number): number {
  // oxlint-disable-next-line unicorn/prefer-math-trunc -- bitwise or wraps to a signed 32-bit int; Math.trunc only drops a fractional part, it never wraps
  return n | 0;
}

function toUint32(n: number): number {
  // oxlint-disable-next-line unicorn/prefer-math-trunc -- unsigned shift reinterprets the sign bit as magnitude; Math.trunc cannot clear it
  return n >>> 0;
}
