import { metrics } from '@opentelemetry/api';

export function recordReplayPokeFailed(): void {
  // The SDK returns the same instrument for an identical registration, and resolving late keeps it
  // bound to whichever meter provider the process registered at boot; without one it is the API's
  // no-op.
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.replay_poke_failed', {
      description: 'replay wake pokes that never delivered after exhausting retries',
      unit: '{poke}',
    });

  counter.add(1);
}
