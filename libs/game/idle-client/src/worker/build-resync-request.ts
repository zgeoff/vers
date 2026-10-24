import type { Deferred } from './build-deferred';
import { buildFlowSignals } from './build-flow-signals';
import type { PendingFlowRequestOf, WorkerLifecycleContext } from './types';

export function buildResyncRequest(
  context: WorkerLifecycleContext,
  avatarID: string,
  claim: boolean,
  deferred: Deferred<void>,
  carryOverDeferreds: ReadonlyArray<Deferred<void>>,
): PendingFlowRequestOf<'resync'> {
  return {
    avatarID,
    carryOverDeferreds,
    claim,
    deferred,
    kind: 'resync',
    signals: buildFlowSignals(context),
  };
}
