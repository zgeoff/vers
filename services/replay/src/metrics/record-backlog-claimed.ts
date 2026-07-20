import { metrics } from '@opentelemetry/api';

/**
 * Records how many chains one drain cycle claimed and adjudicated before finding the queue empty.
 * The histogram is resolved through the global metrics API on every call — the SDK returns the
 * same instrument for an identical registration, and resolving late keeps it bound to whichever
 * meter provider the process registered at boot; without one it is the API's no-op.
 */
export function recordBacklogClaimed(chainCount: number): void {
  const histogram = metrics
    .getMeter('@vers/service-replay')
    .createHistogram('vers.replay.backlog_claimed', {
      description: 'chains claimed and adjudicated in one drain cycle',
      unit: '{chain}',
    });

  histogram.record(chainCount);
}
