import { metrics } from '@opentelemetry/api';

/**
 * Records how long one drain cycle held the `/wake` request open, from its first claim attempt
 * through finding the queue empty. The histogram is resolved through the global metrics API on
 * every call — the SDK returns the same instrument for an identical registration, and resolving
 * late keeps it bound to whichever meter provider the process registered at boot; without one it is
 * the API's no-op.
 */
export function recordDrainDuration(durationSeconds: number): void {
  const histogram = metrics
    .getMeter('@vers/service-replay')
    .createHistogram('vers.replay.drain_duration', {
      description: 'wall-clock duration of one drain cycle',
      unit: 's',
    });

  histogram.record(durationSeconds);
}
