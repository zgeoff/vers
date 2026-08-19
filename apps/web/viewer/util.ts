/** Small shared helpers: deterministic randomness and local-to-world frame transforms. */

/** Deterministic RNG so every rebuild shares one window pattern. */
export function makeRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = Math.trunc(state);
    state = Math.trunc(state + 0x6d_2b_79_f5);
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Rotate a local offset by a yaw and translate it to the anchor's world position. */
export function toWorldOffset(
  anchorX: number,
  anchorZ: number,
  ry: number,
  lx: number,
  lz: number,
): { x: number; z: number } {
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);

  return { x: anchorX + lx * cos + lz * sin, z: anchorZ - lx * sin + lz * cos };
}
