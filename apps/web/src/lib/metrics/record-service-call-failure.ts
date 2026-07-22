import { metrics } from '@opentelemetry/api';
import type { ServiceName } from '@vers/service-auth';

export type ServiceCallFailureReason = 'timeout' | 'transport';

/**
 * Counts one outbound service call that never delivered — either every bounded attempt hit its own
 * per-attempt timeout, or the underlying transport failed outright with no timeout involved. Split
 * by `service` and `reason` so a suspended machine's resume window (`timeout`, self-healing once
 * the machine wakes) reads apart from a genuinely unreachable service (`transport`). The counter is
 * resolved through the global metrics API on every call — the SDK returns the same instrument for
 * an identical registration, and resolving late keeps it bound to whichever meter provider the
 * process registered at boot; without one it is the API's no-op.
 */
export function recordServiceCallFailure(
  service: ServiceName,
  reason: ServiceCallFailureReason,
): void {
  const counter = metrics.getMeter('@vers/web').createCounter('vers.web.service_call_failures', {
    description: 'outbound service calls that never delivered, by service and reason',
    unit: '{call}',
  });

  counter.add(1, { reason, service });
}
