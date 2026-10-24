import type { WorkerLifecycleContext } from './types';

export function isIdleOrRunning(args: Readonly<{ context: WorkerLifecycleContext }>): boolean {
  return args.context.phase === 'idle' || args.context.phase === 'running';
}
