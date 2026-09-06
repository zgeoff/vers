import { WorkerMessageType } from '../types';
import { findLiveRun } from './find-live-run';
import type { WorkerContext } from './types';
import type { WorkerMessage } from './worker-to-client-message-schema';

export function handleSimulationUpdate(context: WorkerContext) {
  const simulation = context.getSimulation();
  const liveRun = findLiveRun(context);

  const message = {
    ...(liveRun !== undefined && { liveRun }),
    state: simulation.getSnapshot(),
    type: WorkerMessageType.SimulationUpdate,
  } satisfies WorkerMessage;

  context.broadcast(message);
}
