import { metrics } from '@opentelemetry/api';

export function recordVerificationLag(lagSeconds: number): void {
  // resolved through the global metrics API on every call — the SDK returns the same instrument
  // for an identical registration, and resolving late keeps it bound to whichever meter provider
  // the process registered at boot; without one it is the API's no-op
  const histogram = metrics
    .getMeter('@vers/service-replay')
    .createHistogram('vers.replay.verification_lag', {
      description: 'seconds between an append landing and a drain cycle confirming it',
      unit: 's',
    });

  histogram.record(lagSeconds);
}
