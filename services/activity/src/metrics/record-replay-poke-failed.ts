import { metrics } from '@opentelemetry/api';

/**
 * Counts one replay wake poke that never delivered after exhausting its retries — the explicit
 * stall signal for the replay queue: an activity progress append landed, but no verifier machine
 * ever learned there was work to drain. The counter is resolved through the global metrics API on
 * every call — the SDK returns the same instrument for an identical registration, and resolving
 * late keeps it bound to whichever meter provider the process registered at boot; without one it is
 * the API's no-op.
 */
export function recordReplayPokeFailed(): void {
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.replay_poke_failed', {
      description: 'replay wake pokes that never delivered after exhausting retries',
      unit: '{poke}',
    });

  counter.add(1);
}
