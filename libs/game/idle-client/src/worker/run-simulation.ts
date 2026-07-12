import type { Simulation } from '@vers/idle-core';
import { ActivityCheckpointType, ActivityFailureAction } from '@vers/idle-core';

export async function runSimulation(simulation: Simulation, timestep: number) {
  if (simulation.activity) {
    const checkpoint = await simulation.run(timestep);

    if (checkpoint?.type === ActivityCheckpointType.Failed) {
      if (simulation.failureAction === ActivityFailureAction.Retry) {
        simulation.restartActivity();
      } else {
        await simulation.stopActivity();
      }
    }

    if (checkpoint?.type === ActivityCheckpointType.Completed) {
      simulation.restartActivity();
    }
  }
}
