import type { ScatterBuildStats } from './types';

/**
 * Mutable scatter-build telemetry the perf HUD samples from the frame loop. This stays out of the
 * Zustand store because of write cadence: the scatter build pipeline writes on every chunk rebuild
 * — not a React state transition — and the one consumer reads imperatively each frame, so a store
 * subscription would add churn without buying any reactivity.
 */
export const scatterBuildStats: ScatterBuildStats = {
  buildMs: 0,
  glowCount: 0,
  partCount: 0,
};
