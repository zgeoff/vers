import { metrics } from '@opentelemetry/api';

export type AdvanceBailoutReason =
  | 'activity_capped'
  | 'chain_quarantined'
  | 'checkpoint_invalid'
  | 'conflict'
  | 'session_evicted'
  | 'terminal';

export function recordAdvanceBailout(reason: AdvanceBailoutReason): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument for
  // an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.advance_bailouts', {
      description:
        "advanceActivity requests that bailed before their continuations' end, by reason",
      unit: '{bailout}',
    });

  counter.add(1, { reason });
}
