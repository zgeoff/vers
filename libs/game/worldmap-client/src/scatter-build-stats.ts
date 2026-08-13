import type { ScatterBuildStats } from './types';

/**
 * Mutable scatter-build telemetry the perf HUD samples every frame. A per-build write must never
 * route through the Zustand store, since that would re-render every store subscriber on every
 * chunk rebuild — so the scatter build pipeline writes its latest counts and duration here
 * directly instead.
 */
export const scatterBuildStats: ScatterBuildStats = {
  buildMs: 0,
  glowCount: 0,
  partCount: 0,
};
