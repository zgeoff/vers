import { fromPromise } from 'xstate';
import { isAbortError } from './is-abort-error';
import { reportWorkerFault } from './report-worker-fault';
import { runStartFlow } from './run-start-flow';
import type { FlowSignals, PendingFlowRequestOf, WorkerContext } from './types';
import type { StartStatus } from './worker-contract';

export const runStartActor = fromPromise<
  StartStatus,
  {
    readonly context: WorkerContext;
    readonly request: PendingFlowRequestOf<'start'>;
    readonly signals: Readonly<FlowSignals>;
  }
>(async (args) => {
  try {
    return await runStartFlow(
      args.input.context,
      args.input.request.input,
      args.input.request.token,
      args.input.signals,
    );
  } catch (error) {
    if (!isAbortError(error, args.input.signals.cancel)) {
      reportWorkerFault('start', error);
    }

    return { kind: 'failed' };
  }
});
