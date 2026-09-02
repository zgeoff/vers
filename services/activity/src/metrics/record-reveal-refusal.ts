import { metrics } from '@opentelemetry/api';

export function recordRevealRefusal(nodeCount: number): void {
  // Resolved through the global metrics API on every call — the SDK returns the same instrument
  // for an identical registration, and resolving late keeps it bound to whichever meter provider
  // the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.reveal_refusals', {
      description: 'nodes refused per revealNodes call for falling outside the revealed region',
      unit: '{node}',
    });

  counter.add(nodeCount);
}
