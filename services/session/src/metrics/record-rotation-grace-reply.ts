import { metrics } from '@opentelemetry/api';

export function recordRotationGraceReply(): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument for
  // an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-session')
    .createCounter('vers.session.rotation_grace_replies', {
      description:
        "refresh calls answered with the session's current token because the presented previous token arrived inside the rotation window",
      unit: '{reply}',
    });

  counter.add(1);
}
