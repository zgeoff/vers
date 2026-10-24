import type { WorkerLifecycleContext } from './types';

export function hasLiveActivity(args: Readonly<{ context: WorkerLifecycleContext }>): boolean {
  return args.context.runtime.getActivity() !== null;
}
