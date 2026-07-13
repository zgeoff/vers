import type { Simulation } from '@vers/idle-core';
import { ActivityCheckpointType, ActivityFailureAction } from '@vers/idle-core';
import type { WorkerContext } from './types';

export async function runSimulation(
  context: WorkerContext,
  simulation: Simulation,
  timestep: number,
) {
  const activityID = simulation.activity?.id;

  if (activityID !== undefined) {
    const checkpoint = await simulation.run(timestep);

    if (checkpoint) {
      await context.getSubmitter().submit(activityID, checkpoint);
    }

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
