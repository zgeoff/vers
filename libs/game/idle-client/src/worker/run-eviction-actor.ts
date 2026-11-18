import { fromPromise } from 'xstate';
import { applyEviction } from './apply-eviction';
import { runFlowBody } from './run-flow-body';
import type { PendingFlowRequestOf, WorkerContext } from './types';

export const runEvictionActor = fromPromise<
  void,
  { readonly context: WorkerContext; readonly request: PendingFlowRequestOf<'eviction'> }
>((args) =>
  runFlowBody('eviction', async () => {
    // the eviction event can land synchronously inside the submitter's flush callback, before the
    // settlement that records the eviction; a macrotask lets that settlement land first
    await waitForMacrotask();

    applyEviction(args.input.context, args.input.request.activityID);
  }),
);

function waitForMacrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
