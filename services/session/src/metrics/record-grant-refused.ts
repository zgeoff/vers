import { metrics } from '@opentelemetry/api';

export function recordGrantRefused(): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument for
  // an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-session')
    .createCounter('vers.session.step_up_grant_refusals', {
      description:
        'step-up grant redemptions refused as reused, expired, unknown, or issued for another action, target, or session',
      unit: '{redemption}',
    });

  counter.add(1);
}
