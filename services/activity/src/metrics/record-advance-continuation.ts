import { metrics } from '@opentelemetry/api';

export type AdvanceContinuationOutcome = 'converged' | 'minted';

export function recordAdvanceContinuation(outcome: AdvanceContinuationOutcome): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument
  // for an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.advance_continuations', {
      description: 'advanceActivity continuations processed, by mint outcome',
      unit: '{continuation}',
    });

  counter.add(1, { outcome });
}
