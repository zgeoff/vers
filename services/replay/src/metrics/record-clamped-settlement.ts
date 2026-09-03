import { metrics } from '@opentelemetry/api';

export function recordClampedSettlement(): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument for
  // an identical registration, and resolving late keeps it bound to whichever meter provider the
  // process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-replay')
    .createCounter('vers.replay.clamped_settlements', {
      description: 'settlements whose debit was floored at zero, paying less than recorded',
      unit: '{settlement}',
    });

  counter.add(1);
}
