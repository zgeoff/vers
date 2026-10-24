import { WorkerMessageType } from '../types';
import { resetSimulation } from './reset-simulation';
import type { WorkerLifecycleContext } from './types';

export function applyStopHalt(context: WorkerLifecycleContext): void {
  context.runtime.getSimulation().stopActivity();

  resetSimulation(context.runtime);

  context.runtime.resetRewardSlotLedger();

  context.runtime.broadcast({
    state: { failureAction: context.runtime.getFailureAction() },
    type: WorkerMessageType.SimulationUpdate,
  });
}
