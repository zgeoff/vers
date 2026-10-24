import { fromPromise } from 'xstate';
import { runContinuation } from './run-continuation';
import { runFlowBody } from './run-flow-body';
import type { PendingFlowRequestOf, WorkerContext } from './types';

export const runContinuationActor = fromPromise<
  void,
  { readonly context: WorkerContext; readonly request: PendingFlowRequestOf<'continuation'> }
>((args) =>
  runFlowBody('continuation', () =>
    runContinuation(args.input.context, args.input.request.simulation, args.input.request.activity),
  ),
);
