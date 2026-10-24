import type { Deferred } from './build-deferred';
import { buildFlowSignals } from './build-flow-signals';
import type { PendingFlowRequestOf, WorkerLifecycleContext } from './types';

interface BuildResyncRequestOptions {
  readonly context: WorkerLifecycleContext;
  readonly avatarID: string;
  readonly claim: boolean;
  readonly deferred: Deferred<void>;
  readonly carryOverDeferreds: ReadonlyArray<Deferred<void>>;
}

export function buildResyncRequest(
  options: BuildResyncRequestOptions,
): PendingFlowRequestOf<'resync'> {
  return {
    avatarID: options.avatarID,
    carryOverDeferreds: options.carryOverDeferreds,
    claim: options.claim,
    deferred: options.deferred,
    kind: 'resync',
    signals: buildFlowSignals(options.context),
  };
}
