import type { Simulation } from '@vers/idle-core';

let simulation: null | Simulation = null;

export function getSimulation(): null | Simulation {
  return simulation;
}

export function setSimulation(newSimulation: null | Simulation) {
  simulation = newSimulation;
}
