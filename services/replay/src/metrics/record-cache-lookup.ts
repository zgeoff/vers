import { metrics } from '@opentelemetry/api';

export type CacheLookupOutcome = 'hit' | 'miss' | 'stale';

export function recordCacheLookup(outcome: CacheLookupOutcome): void {
  // Resolved through the global metrics API on every call: the SDK returns the same instrument
  // for an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-replay')
    .createCounter('vers.replay.cache_lookups', {
      description: 'cached replay streams looked up for a claimed batch, by what the lookup found',
      unit: '{lookup}',
    });

  counter.add(1, { outcome });
}
