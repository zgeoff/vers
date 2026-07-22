import { metrics } from '@opentelemetry/api';

/**
 * Counts one `startActivity` call rejected because the starting avatar is not the account's
 * active one. Attribute-free — the rejection has no dimension worth splitting on. The counter is
 * resolved through the global metrics API on every call — the SDK returns the same instrument for
 * an identical registration, and resolving late keeps the counter bound to whichever meter
 * provider the process registered at boot; without one it is the API's no-op.
 */
export function recordAvatarNotActiveRejection(): void {
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.avatar_not_active_rejections', {
      description: 'startActivity calls rejected because the starting avatar is not active',
      unit: '{rejection}',
    });

  counter.add(1);
}
