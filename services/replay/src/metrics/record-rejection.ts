import { metrics } from '@opentelemetry/api';

export type RejectionReason =
  | 'build-mismatch'
  | 'descriptor-mismatch'
  | 'elapsed-time'
  | 'integrity-mismatch'
  | 'node-unreachable'
  | 'provider-unavailable'
  | 'version-park';

export function recordRejection(reason: RejectionReason): void {
  // Resolved through the global metrics API on every call — the SDK returns the same instrument
  // for an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-replay')
    .createCounter('vers.verification.rejections', {
      description: 'adjudications that rejected or parked an activity, by reason',
      unit: '{rejection}',
    });

  counter.add(1, { reason });
}
