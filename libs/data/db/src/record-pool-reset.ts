import { metrics } from '@opentelemetry/api';

export function recordPoolReset(): void {
  // Resolved through the global metrics API on every call — the SDK returns the same instrument
  // for an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics.getMeter('@vers/db').createCounter('vers.db.pool_resets', {
    description: 'connection pools dropped after a detected process resume',
    unit: '{reset}',
  });

  counter.add(1);
}
