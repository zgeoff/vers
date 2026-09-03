import { SIMULATION_TIMESTEP_MS } from '@vers/idle-core';

const DURATION_MARGIN_RATIO = 0.1;

export function buildSegmentDuration(appendedTimeMs: number, checkpointCount: number): number {
  return (
    Math.ceil(appendedTimeMs * (1 + DURATION_MARGIN_RATIO)) +
    SIMULATION_TIMESTEP_MS * checkpointCount
  );
}
