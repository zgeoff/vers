import { metrics } from '@opentelemetry/api';

export type IterationFailureOutcome = 'errored' | 'quarantined';

export function recordIterationFailure(outcome: IterationFailureOutcome): void {
  // The SDK returns the same instrument for an identical registration, and resolving late keeps
  // the counter bound to whichever meter provider the process registered at boot; without one it
  // is the API's no-op.
  const counter = metrics
    .getMeter('@vers/service-replay')
    .createCounter('vers.replay.iteration_failures', {
      description: 'drain iterations that failed to replay a claimed chain, by outcome',
      unit: '{iteration}',
    });

  counter.add(1, { outcome });
}
