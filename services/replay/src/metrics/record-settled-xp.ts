import { metrics } from '@opentelemetry/api';

type SettlementSource = 'progress' | 'terminal';

// an up-down counter, not a histogram: the measure is signed (a failed run's terminal settles a
// negative), and an OpenTelemetry histogram discards negative recordings
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
