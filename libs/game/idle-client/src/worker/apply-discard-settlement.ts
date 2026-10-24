import invariant from 'tiny-invariant';
import { match } from 'ts-pattern';
import { reportWorkerFault } from './report-worker-fault';
import type { DiscardOutcome, WorkerLifecycleContext } from './types';

export function applyDiscardSettlement(
  context: WorkerLifecycleContext,
  outcome: Readonly<DiscardOutcome>,
): void {
  const request = context.currentRequest;

  invariant(request?.kind === 'discard', 'expected a queued discard request');

  match({ outcome, trigger: request.trigger })
    .with({ outcome: { kind: 'done' }, trigger: { kind: 'sign-out' } }, (settled) => {
      settled.trigger.deferred.resolve();
    })
    .with({ outcome: { kind: 'failed' }, trigger: { kind: 'sign-out' } }, (settled) => {
      settled.trigger.deferred.reject(settled.outcome.error);
    })
    .with({ outcome: { kind: 'done' }, trigger: { kind: 'takeover' } }, () => {})
    .with({ outcome: { kind: 'failed' }, trigger: { kind: 'takeover' } }, (settled) => {
      // no caller awaits a takeover's discard, and the work it failed to clear stays queued until
      // the next superseded answer discards again
      reportWorkerFault('discard', settled.outcome.error);
    })
    .exhaustive();
}
