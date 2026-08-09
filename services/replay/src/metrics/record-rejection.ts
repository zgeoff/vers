import { metrics } from '@opentelemetry/api';

export type RejectionReason =
  | 'descriptor-mismatch'
  | 'elapsed-time'
  | 'integrity-mismatch'
  | 'provider-unavailable'
  | 'unbacked-snapshot'
  | 'version-park';

/**
 * Counts one adjudication that refused or held a stream, split by reason: `integrity-mismatch`
 * covers confirmed divergence and seed validation, `descriptor-mismatch` covers a sealed node's
 * content fields failing to reproduce against a freshly read scope secret, `version-park` covers
 * version-registry holds (unknown or retention-expired sim versions), `elapsed-time` covers
 * duration-cap trips, `provider-unavailable` covers a cross-version dispatch whose provider timed
 * out, refused the connection, or answered with an undefined error, and `unbacked-snapshot` covers
 * a build snapshot that borrowed xp from a run since rejected. The counter is resolved through the
 * global metrics API on every call — the SDK returns the same instrument for an identical
 * registration, and resolving late keeps the counter bound to whichever meter provider the process
 * registered at boot; without one it is the API's no-op.
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
