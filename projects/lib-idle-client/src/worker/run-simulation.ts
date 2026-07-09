import type { Simulation } from '@vers/idle-core';
import { ActivityCheckpointType } from '@vers/idle-core';

export async function runSimulation(simulation: Simulation, timestep: number) {
  if (simulation.activity) {
    const checkpoint = await simulation.run(timestep);

    if (checkpoint?.type === ActivityCheckpointType.Failed) {
      simulation.restartActivity();
    }

    if (checkpoint?.type === ActivityCheckpointType.Completed) {
      simulation.restartActivity();
    }
  }
}
