import { metrics } from '@opentelemetry/api';

/**
 * Counts a settlement whose debit exceeded the avatar's settled xp, so the identity write floored
 * at zero and paid less than the segment recorded against the activity. The engine clamps a
 * failure penalty to the progress made into the current level, so this should never fire — it
 * exists because the shortfall is otherwise silent, and a non-zero count means the penalty and the
 * settled total are being computed against different bases.
 */
export function recordClampedSettlement(): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument for
  // an identical registration, and resolving late keeps it bound to whichever meter provider the
  // process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-replay')
    .createCounter('vers.replay.clamped_settlements', {
      description: 'settlements whose debit was floored at zero, paying less than recorded',
      unit: '{settlement}',
    });

  counter.add(1);
}
