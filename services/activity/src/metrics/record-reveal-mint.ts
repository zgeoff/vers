import { metrics } from '@opentelemetry/api';

/**
 * Counts activity-chain rows a `revealNodes` call minted or re-affirmed, one recording per call
 * carrying the number of distinct nodes it processed. Resolved through the global metrics API on
 * every call — the SDK returns the same instrument for an identical registration, and resolving
 * late keeps it bound to whichever meter provider the process registered at boot; without one it is
 * the API's no-op.
 */
export function recordRevealMint(nodeCount: number): void {
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.reveal_mints', {
      description: 'activity-chain rows minted or re-affirmed per revealNodes call',
      unit: '{node}',
    });

  counter.add(nodeCount);
}
