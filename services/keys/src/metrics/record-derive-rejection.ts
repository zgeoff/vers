import { metrics } from '@opentelemetry/api';

export type DeriveRejectionReason = 'unknown-key-version' | 'unknown-scope-secret-version';

export function recordDeriveRejection(reason: DeriveRejectionReason): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument
  // for an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-keys')
    .createCounter('vers.keys.derive_rejections', {
      description: 'derivation calls that refused to derive a roll key or scope secret, by reason',
      unit: '{rejection}',
    });

  counter.add(1, { reason });
}
