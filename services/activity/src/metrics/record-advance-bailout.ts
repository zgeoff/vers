import { metrics } from '@opentelemetry/api';

export type AdvanceBailoutReason =
  | 'activity_capped'
  | 'chain_quarantined'
  | 'checkpoint_invalid'
  | 'conflict'
  | 'session_evicted'
  | 'terminal';

/**
 * Counts one `advanceActivity` request that bailed before processing every requested
 * continuation, split by the rejection that stopped it. A bailout always leaves the confirmed head
 * advanced past the committed prefix, so a rising count here tracks how often an offline catch-up's
 * outer resync must re-plan, not lost progress. The counter is resolved through the global metrics
 * API on every call — the SDK returns the same instrument for an identical registration, and
 * resolving late keeps the counter bound to whichever meter provider the process registered at
 * boot; without one it is the API's no-op.
 */
export function recordAdvanceBailout(reason: AdvanceBailoutReason): void {
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.advance_bailouts', {
      description:
        "advanceActivity requests that bailed before their continuations' end, by reason",
      unit: '{bailout}',
    });

  counter.add(1, { reason });
}
