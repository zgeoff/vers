import { metrics } from '@opentelemetry/api';

interface RevealQueryFanOut {
  readonly cellCount: number;
  readonly sourceCount: number;
}

export function recordRevealQuery(fanOut: RevealQueryFanOut): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument for
  // an identical registration, and resolving late keeps it bound to whichever meter provider the
  // process registered at boot; without one it's the API's no-op.
  const meter = metrics.getMeter('@vers/service-activity');

  meter
    .createHistogram('vers.activity.reveal_cells', {
      description: 'revealed cells returned per getRevealedNodes query',
      unit: '{cell}',
    })
    .record(fanOut.cellCount);

  meter
    .createHistogram('vers.activity.reveal_sources', {
      description: 'first-clear grant rows scanned per getRevealedNodes query',
      unit: '{grant}',
    })
    .record(fanOut.sourceCount);
}
