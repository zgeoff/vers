import { metrics } from '@opentelemetry/api';

/**
 * Counts one active-avatar-gated call — an activity-start admission or a reveal — rejected because the
 * acting avatar is not the account's active one. Attribute-free — the rejection has no dimension
 * worth splitting on.
 */
export function recordAvatarNotActiveRejection(): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument for
  // an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.avatar_not_active_rejections', {
      description: 'active-avatar-gated calls rejected because the acting avatar is not active',
      unit: '{rejection}',
    });

  counter.add(1);
}
