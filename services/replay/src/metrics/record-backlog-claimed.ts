import { metrics } from '@opentelemetry/api';

export function recordBacklogClaimed(chainCount: number): void {
  // The histogram is resolved through the global metrics API on every call: the SDK returns the
  // same instrument for an identical registration, and resolving late keeps it bound to whichever
  // meter provider the process registered at boot; without one it is the API's no-op.
  const histogram = metrics
    .getMeter('@vers/service-replay')
    .createHistogram('vers.replay.backlog_claimed', {
      description: 'chains claimed and adjudicated in one drain cycle',
      unit: '{chain}',
    });

  histogram.record(chainCount);
}
