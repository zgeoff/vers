import type { ScatterBuildStats } from './types';

/**
 * Mutable chunk-build telemetry the perf HUD samples from the frame loop. This stays out of the
 * Zustand store because of write cadence: a chunk-stream layer writes on every progressive-build
 * tick — not a React state transition — and the one consumer reads imperatively each frame, so a
 * store subscription would add churn without buying any reactivity. `buildMs` carries whichever
 * layer built most recently; `glowCount` and `partCount` stay at their default until a scatter
 * layer streams instanced parts through the same chunk cache.
 */
export const scatterBuildStats: ScatterBuildStats = {
  buildMs: 0,
  glowCount: 0,
  partCount: 0,
};
