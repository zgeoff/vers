import { metrics } from '@opentelemetry/api';
import type { ServiceName } from '@vers/service-auth';

export type ServiceCallFailureReason = 'timeout' | 'transport';

export function recordServiceCallFailure(
  service: ServiceName,
  reason: ServiceCallFailureReason,
): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument for
  // an identical registration, and resolving late keeps it bound to whichever meter provider the
  // process registered at boot; without one it is the API's no-op.
  const counter = metrics.getMeter('@vers/web').createCounter('vers.web.service_call_failures', {
    description: 'outbound service calls that never delivered, by service and reason',
    unit: '{call}',
  });

  counter.add(1, { reason, service });
}
