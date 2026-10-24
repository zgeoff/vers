import { fromPromise } from 'xstate';
import { applyEviction } from './apply-eviction';
import { runFlowBody } from './run-flow-body';
import type { PendingFlowRequestOf, WorkerContext } from './types';

export const runEvictionActor = fromPromise<
  void,
  { readonly context: WorkerContext; readonly request: PendingFlowRequestOf<'eviction'> }
>((args) =>
  runFlowBody('eviction', async () => {
    // SUBMITTER_EVICTED can land synchronously inside the submitter's own flush callback, ahead
    // of the child settlement that records the eviction on the submitter — waiting a macrotask
    // lets every microtask that settlement rides land first, so the guard below reads it
    await waitForMacrotask();

    applyEviction(args.input.context, args.input.request.activityID);
  }),
);

function waitForMacrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
