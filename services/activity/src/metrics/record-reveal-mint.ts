import { metrics } from '@opentelemetry/api';

export function recordRevealMint(nodeCount: number): void {
  // Resolved through the global metrics API on every call — the SDK returns the same instrument
  // for an identical registration, and resolving late keeps it bound to whichever meter provider
  // the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.reveal_mints', {
      description: 'activity-chain rows minted or re-affirmed per revealNodes call',
      unit: '{node}',
    });

  counter.add(nodeCount);
}
