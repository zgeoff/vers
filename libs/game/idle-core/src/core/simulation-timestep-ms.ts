/**
 * Fixed timestep every simulation driver ticks with, in milliseconds. Checkpoint content is
 * timestep-sensitive: the live worker loop, the offline fast-forward, and the verifier's replay
 * must advance the engine in identical steps for replay to reproduce a submitted stream
 * byte-for-byte.
 */
export const SIMULATION_TIMESTEP_MS = 50;
