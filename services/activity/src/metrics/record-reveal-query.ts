import { metrics } from '@opentelemetry/api';

interface RevealQueryFanOut {
  readonly cellCount: number;
  readonly sourceCount: number;
}

/**
 * Records one reveal query's fan-out: how many first-clear grant rows the query scanned for reveal
 * sources, and how many revealed cells the projection returned for the queried viewport.
 * Event-recorded, so both histograms emit only while a reveal query actually runs. Resolved through
 * the global metrics API on every call — the SDK returns the same instrument for an identical
 * registration, and resolving late keeps them bound to whichever meter provider the process
 * registered at boot; without one they are the API's no-op.
 */
export function recordRevealQuery(fanOut: RevealQueryFanOut): void {
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
