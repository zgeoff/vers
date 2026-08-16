import { metrics } from '@opentelemetry/api';

/**
 * Counts one `startActivity` call rejected because the caller's stamped predecessor activity has
 * not reached the server yet. Attribute-free — the rejection has no dimension worth splitting on.
 */
export function recordPredecessorPendingRejection(): void {
  // resolved through the global metrics API on every call — the SDK returns the same instrument
  // for an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.predecessor_pending_rejections', {
      description:
        "startActivity calls rejected because the stamped predecessor activity hasn't landed yet",
      unit: '{rejection}',
    });

  counter.add(1);
}
