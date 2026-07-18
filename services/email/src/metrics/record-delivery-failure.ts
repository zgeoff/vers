import { metrics } from '@opentelemetry/api';

/**
 * Counts one email that failed to deliver: a job whose handler or completion step failed, or the
 * boot-time drain itself faulting before any per-job outcome was reached. The counter is resolved
 * through the global metrics API on every call — the SDK returns the same instrument for an
 * identical registration, and resolving late keeps the counter bound to whichever meter provider
 * the process registered at boot; without one it is the API's no-op.
 */
export function recordDeliveryFailure(): void {
  const counter = metrics
    .getMeter('@vers/service-email')
    .createCounter('vers.email.delivery_failures', {
      description: 'emails that failed to deliver',
      unit: '{email}',
    });

  counter.add(1);
}
