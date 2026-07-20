import { metrics } from '@opentelemetry/api';

/**
 * Counts one successful writer claim on an active activity — a take-over of another session's
 * stream, a claim of an unstamped one, or a same-session re-claim alike; the claim statement
 * cannot tell them apart. The counter is resolved through the global metrics API on every call —
 * the SDK returns the same instrument for an identical registration, and resolving late keeps the
 * counter bound to whichever meter provider the process registered at boot; without one it is the
 * API's no-op.
 */
export function recordWriterTakeover(): void {
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.writer_takeovers', {
      description: 'successful writer-session claims on active activities',
      unit: '{takeover}',
    });

  counter.add(1);
}
