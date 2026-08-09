import { metrics } from '@opentelemetry/api';

export type DeriveRejectionReason = 'unknown-key-version' | 'unknown-scope-secret-version';

/**
 * Counts one derivation call — an avatar roll key or a scope secret — that refused to derive,
 * split by reason. The counter is resolved through the global metrics API on every call — the SDK
 * returns the same instrument for an identical registration, and resolving late keeps the counter
 * bound to whichever meter provider the process registered at boot; without one it is the API's
 * no-op.
 */
export function recordDeriveRejection(reason: DeriveRejectionReason): void {
  const counter = metrics
    .getMeter('@vers/service-keys')
    .createCounter('vers.keys.derive_rejections', {
      description: 'derivation calls that refused to derive a roll key or scope secret, by reason',
      unit: '{rejection}',
    });

  counter.add(1, { reason });
}
