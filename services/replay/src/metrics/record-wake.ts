import { metrics } from '@opentelemetry/api';

export function recordWake(): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument
  // for an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics.getMeter('@vers/service-replay').createCounter('vers.replay.wake', {
    description: 'wake requests received',
    unit: '{wake}',
  });

  counter.add(1);
}
