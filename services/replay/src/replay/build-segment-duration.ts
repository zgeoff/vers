import { SIMULATION_TIMESTEP_MS } from '@vers/idle-core';

/**
 * Proportional slack over the activity's own server-accumulated time, covering ticks between the
 * last recorded checkpoint and a legitimate batch boundary.
 */
const DURATION_MARGIN_RATIO = 0.1;

/**
 * Sizes a replay's duration safety cap from the activity row's own `appendedTimeMs` — server-
 * accumulated and dedupe-protected, so a forged batch can't inflate it — plus a proportional
 * margin and one timestep per checkpoint. This is a work bound, not the replay's stop condition:
 * the caller's `expectedCheckpointCount` drives the actual halt, and an honest stream should never
 * trip this cap; when it does, the caller treats that as an operational hold, never divergence.
 */
export function buildSegmentDuration(appendedTimeMs: number, checkpointCount: number): number {
  return (
    Math.ceil(appendedTimeMs * (1 + DURATION_MARGIN_RATIO)) +
    SIMULATION_TIMESTEP_MS * checkpointCount
  );
}
