import { metrics } from '@opentelemetry/api';

/**
 * Counts nodes a `revealNodes` call refused to mint because they fall outside the avatar's revealed
 * region, one recording per call carrying the number of distinct nodes it dropped. A call that
 * refuses nothing records nothing, so any non-zero rate is a client asking for ground it has not
 * earned sight of — a modified client fishing for genesis seeds, or a defect that has put the
 * client's fog projection ahead of the server's.
 */
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
