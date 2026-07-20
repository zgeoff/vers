import { metrics } from '@opentelemetry/api';

/**
 * Records how long one newly verified append sat unverified, from its own appended timestamp to
 * the moment a drain cycle confirmed it. Event-recorded, so it emits only while a drain is
 * actually verifying appends — an idle machine reports nothing. The histogram is resolved through
 * the global metrics API on every call — the SDK returns the same instrument for an identical
 * registration, and resolving late keeps it bound to whichever meter provider the process
 * registered at boot; without one it is the API's no-op.
 */
export function recordVerificationLag(lagSeconds: number): void {
  const histogram = metrics
    .getMeter('@vers/service-replay')
    .createHistogram('vers.replay.verification_lag', {
      description: 'seconds between an append landing and a drain cycle confirming it',
      unit: 's',
    });

  histogram.record(lagSeconds);
}
