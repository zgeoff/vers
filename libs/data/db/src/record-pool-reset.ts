import { metrics } from '@opentelemetry/api';
import type { PoolResetReason } from './types';

export function recordPoolReset(reason: PoolResetReason): void {
  // Resolved through the global metrics API on every call — the SDK returns the same instrument
  // for an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics.getMeter('@vers/db').createCounter('vers.db.pool_resets', {
    description: 'connection pools dropped, by what dropped them',
    unit: '{reset}',
  });

  counter.add(1, { reason });
}
