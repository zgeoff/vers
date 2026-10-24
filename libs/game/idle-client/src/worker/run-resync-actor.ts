import { fromPromise } from 'xstate';
import { runFlowBody } from './run-flow-body';
import { runResyncFlow } from './run-resync-flow';
import type { PendingFlowRequestOf, WorkerContext } from './types';

export const runResyncActor = fromPromise<
  void,
  { readonly context: WorkerContext; readonly request: PendingFlowRequestOf<'resync'> }
>((args) =>
  runFlowBody('resync', () =>
    runResyncFlow(
      args.input.context,
      args.input.request.avatarID,
      args.input.request.claim,
      args.input.request.signals,
    ),
  ),
);
