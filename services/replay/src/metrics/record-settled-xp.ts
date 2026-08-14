import { metrics } from '@opentelemetry/api';

/**
 * How a settled segment derived its xp: a `terminal` segment settles the run's final total net of
 * whatever earlier segments already paid, while `progress` settles the sum of the per-checkpoint
 * deltas it verified.
 */
type SettlementSource = 'progress' | 'terminal';

/**
 * Records one verified segment's xp movement, split by how the amount was derived. An up-down
 * counter rather than a histogram because the measure is signed — a failed run's terminal settles
 * the death penalty as a negative, and a histogram discards negative recordings, which would hide
 * exactly the sign and ordering defects this instrument exists to catch.
 */
export function recordSettledXP(xpDelta: number, source: SettlementSource): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument for
  // an identical registration, and resolving late keeps it bound to whichever meter provider the
  // process registered at boot; without one it's the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-replay')
    .createUpDownCounter('vers.replay.settled_xp', {
      description: 'xp verified segments settled to avatars, by how the amount was derived',
      unit: '{xp}',
    });

  counter.add(xpDelta, { source });
}
