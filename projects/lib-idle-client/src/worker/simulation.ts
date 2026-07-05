import type { Simulation } from '@vers/idle-core';

let simulation: null | Simulation = null;

export function getSimulation(): null | Simulation {
  return simulation;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function setSimulation(newSimulation: null | Simulation) {
  simulation = newSimulation;
}
