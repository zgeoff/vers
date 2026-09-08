import { metrics } from '@opentelemetry/api';

export type BackoffReason = 'deadline' | 'errored' | 'keys-unavailable' | 'provider-unavailable';

export function recordBackoff(reason: BackoffReason): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument
  // for an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics.getMeter('@vers/service-replay').createCounter('vers.replay.backoffs', {
    description: 'claimed activities the verifier backed off instead of adjudicating, by reason',
    unit: '{backoff}',
  });

  counter.add(1, { reason });
}
