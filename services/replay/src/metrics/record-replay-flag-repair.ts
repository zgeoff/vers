import { metrics } from '@opentelemetry/api';

export type ReplayFlagRepair = 'cleared' | 'flagged';

export function recordReplayFlagRepair(repair: ReplayFlagRepair, chainCount: number): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument
  // for an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-replay')
    .createCounter('vers.replay.flag_repairs', {
      description: 'chains whose replay flag the pass at the start of a drain corrected',
      unit: '{chain}',
    });

  counter.add(chainCount, { repair });
}
