import { metrics } from '@opentelemetry/api';

export type ContentIncompatiblePath = 'fallback' | 'requested';

export function recordContentIncompatibleRejection(path: ContentIncompatiblePath): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument for
  // an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.content_incompatible_rejections', {
      description:
        "activity-start admissions rejected because the resolved engine's max content version falls behind the requested content",
      unit: '{rejection}',
    });

  counter.add(1, { path });
}
