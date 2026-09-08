import { metrics } from '@opentelemetry/api';

export type WakeSource = 'boot' | 'poke' | 'schedule';

export function recordWake(source: WakeSource): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument
  // for an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics.getMeter('@vers/service-replay').createCounter('vers.replay.wake', {
    description: 'drains started, by what started them',
    unit: '{wake}',
  });

  counter.add(1, { source });
}
