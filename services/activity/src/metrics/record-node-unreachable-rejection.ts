import { metrics } from '@opentelemetry/api';

/**
 * Counts one `startActivity` call rejected because the requested scope node sits outside the
 * avatar's selectable set. Attribute-free — the rejection has no dimension worth splitting on. The
 * counter is resolved through the global metrics API on every call — the SDK returns the same
 * instrument for an identical registration, and resolving late keeps the counter bound to whichever
 * meter provider the process registered at boot; without one it is the API's no-op.
 */
export function recordNodeUnreachableRejection(): void {
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.node_unreachable_rejections', {
      description:
        'startActivity calls rejected because the scope node is outside the selectable set',
      unit: '{rejection}',
    });

  counter.add(1);
}
