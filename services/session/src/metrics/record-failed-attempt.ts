import { metrics } from '@opentelemetry/api';

/**
 * Counts one failed step-up verification attempt. The counter is resolved through the global
 * metrics API on every call — the SDK returns the same instrument for an identical registration,
 * and resolving late keeps the counter bound to whichever meter provider the process registered at
 * boot; without one it is the API's no-op.
 */
export function recordFailedAttempt(): void {
  const counter = metrics
    .getMeter('@vers/service-session')
    .createCounter('vers.session.failed_attempts', {
      description: 'failed step-up verification attempts',
      unit: '{attempt}',
    });

  counter.add(1);
}
