import type { WorkerLifecycleContext } from './types';

export function isFlowActive(args: Readonly<{ context: WorkerLifecycleContext }>): boolean {
  return (
    args.context.phase === 'starting' ||
    args.context.phase === 'resyncing' ||
    args.context.phase === 'continuing' ||
    args.context.phase === 'evicting' ||
    args.context.phase === 'discarding'
  );
}
