import type { DiscardTrigger, WorkerLifecycleContext } from './types';

export function hasQueuedTakeoverDiscard(
  context: WorkerLifecycleContext,
  trigger: Readonly<DiscardTrigger>,
): boolean {
  return (
    trigger.kind === 'takeover' &&
    context.pending.some(
      (request) => request.kind === 'discard' && request.trigger.kind === 'takeover',
    )
  );
}
