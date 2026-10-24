import type { WorkerLifecycleContext } from './types';

// a start folds its build snapshot from the avatar's latest-run record, which only a settled resync
// or a live run writes — a start that arrives ahead of the boot resync would fold from an empty
// record and mint a snapshot the server refuses
export function shouldResyncBeforeStart(context: WorkerLifecycleContext): boolean {
  const request = context.currentRequest;

  if (request?.kind !== 'start' || request.awaitedResync) {
    return false;
  }

  const avatarID = request.input.avatarID;
  const runtime = context.runtime;

  return (
    runtime.getLatestRun()?.avatarID !== avatarID && runtime.getActivity()?.avatarID !== avatarID
  );
}
