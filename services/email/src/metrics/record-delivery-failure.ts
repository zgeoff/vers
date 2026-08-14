import { metrics } from '@opentelemetry/api';

/**
 * Counts one email that failed to deliver: a job whose handler or completion step failed.
 */
export function recordDeliveryFailure(): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument for
  // an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-email')
    .createCounter('vers.email.delivery_failures', {
      description: 'emails that failed to deliver',
      unit: '{email}',
    });

  counter.add(1);
}
