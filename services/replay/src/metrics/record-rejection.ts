import { metrics } from '@opentelemetry/api';

export type RejectionReason =
  | 'elapsed-time'
  | 'integrity-mismatch'
  | 'provider-unavailable'
  | 'version-park';

/**
 * Counts one adjudication that refused or held a stream, split by reason: `integrity-mismatch`
 * covers confirmed divergence and seed validation, `version-park` covers version-registry holds
 * (unknown or retention-expired sim versions), `elapsed-time` covers duration-cap trips, and
 * `provider-unavailable` covers a cross-version dispatch whose provider timed out, refused the
 * connection, or answered with an undefined error. The counter is resolved through the global
 * metrics API on every call — the SDK returns the same instrument for an identical registration,
 * and resolving late keeps the counter bound to whichever meter provider the process registered at
 * boot; without one it is the API's no-op.
 */
export function recordRejection(reason: RejectionReason): void {
  const counter = metrics
    .getMeter('@vers/service-replay')
    .createCounter('vers.verification.rejections', {
      description: 'adjudications that rejected or parked an activity, by reason',
      unit: '{rejection}',
    });

  counter.add(1, { reason });
}
