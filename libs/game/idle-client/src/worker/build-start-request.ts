import type { PendingFlowRequestOf, WorkerLifecycleEvent } from './types';

type StartEvent = Extract<WorkerLifecycleEvent, { readonly type: 'START' }>;

export function buildStartRequest(
  event: Readonly<StartEvent>,
  token: string,
): PendingFlowRequestOf<'start'> {
  return {
    awaitedResync: false,
    deferred: event.deferred,
    input: event.input,
    kind: 'start',
    token,
  };
}
