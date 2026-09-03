import { metrics } from '@opentelemetry/api';

export type DeliveryFailureReason = 'quarantined' | 'rejected' | 'unreachable';

export function recordDeliveryFailure(reason: DeliveryFailureReason): void {
  // Resolved through the global metrics API on every call — the SDK returns the same instrument
  // for an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/product-analytics')
    .createCounter('vers.analytics.delivery_failures', {
      description: 'product events that never landed in the Tinybird data source, by reason',
      unit: '{event}',
    });

  counter.add(1, { reason });
}
