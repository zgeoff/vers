import { metrics } from '@opentelemetry/api';

/**
 * Counts one `/wake` request received, before it collapses onto an already-running drain or starts
 * a new one — the poke-rate signal, silent whenever the queue never needs waking. The counter is
 * resolved through the global metrics API on every call — the SDK returns the same instrument for
 * an identical registration, and resolving late keeps the counter bound to whichever meter provider
 * the process registered at boot; without one it is the API's no-op.
 */
export function recordWake(): void {
  const counter = metrics.getMeter('@vers/service-replay').createCounter('vers.replay.wake', {
    description: 'wake requests received',
    unit: '{wake}',
  });

  counter.add(1);
}
