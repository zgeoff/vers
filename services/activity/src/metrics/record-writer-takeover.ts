import { metrics } from '@opentelemetry/api';

/**
 * Counts one successful writer take-over: a session claimed an active activity's stream from its
 * stamped writer. The counter is resolved through the global metrics API on every call — the SDK
 * returns the same instrument for an identical registration, and resolving late keeps the counter
 * bound to whichever meter provider the process registered at boot; without one it is the API's
 * no-op.
 */
export function recordWriterTakeover(): void {
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.writer_takeovers', {
      description: 'active activities whose writer session was taken over',
      unit: '{takeover}',
    });

  counter.add(1);
}
