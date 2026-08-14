import { metrics } from '@opentelemetry/api';
import type { ServiceName } from '@vers/service-auth';

/**
 * Counts one retry attempt against an outbound service call that failed its previous attempt — the
 * signal for how often a bounded service call recovers through retry rather than succeeding on its
 * first attempt.
 */
export function recordServiceCallRetry(service: ServiceName): void {
  // Resolved on every call: the SDK returns the same instrument for an identical registration, and
  // resolving late keeps it bound to whichever meter provider the process registered at boot;
  // without one it is the API's no-op.
  const counter = metrics.getMeter('@vers/web').createCounter('vers.web.service_call_retries', {
    description: 'retry attempts against an outbound service call that failed its previous attempt',
    unit: '{retry}',
  });

  counter.add(1, { service });
}
