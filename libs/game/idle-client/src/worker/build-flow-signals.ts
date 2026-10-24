import type { FlowSignals, WorkerLifecycleContext } from './types';

export function buildFlowSignals(context: WorkerLifecycleContext): FlowSignals {
  return { cancel: context.cancelSignal, stop: context.stopController.signal };
}
