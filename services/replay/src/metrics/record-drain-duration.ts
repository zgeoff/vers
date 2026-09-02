import { metrics } from '@opentelemetry/api';

export function recordDrainDuration(durationSeconds: number): void {
  // resolved through the global metrics API on every call — the SDK returns the same instrument
  // for an identical registration, and resolving late keeps it bound to whichever meter provider
  // the process registered at boot; without one it is the API's no-op
  const histogram = metrics
    .getMeter('@vers/service-replay')
    .createHistogram('vers.replay.drain_duration', {
      description: 'wall-clock duration of one drain cycle',
      unit: 's',
    });

  histogram.record(durationSeconds);
}
