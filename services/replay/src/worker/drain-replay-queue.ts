import { reportUnexpectedError } from '@vers/service-runtime';
import { withRootSpan } from '@vers/service-utils';
import { recordBacklogClaimed } from '../metrics/record-backlog-claimed';
import { recordDrainDuration } from '../metrics/record-drain-duration';
import { recordIterationFailure } from '../metrics/record-iteration-failure';
import { recordWake } from '../metrics/record-wake';
import { createReplayCache } from '../replay/create-replay-cache';
import { runReplayIteration } from './run-replay-iteration';
import type { ReplayWorkerDeps } from './types';

let drainInFlight: Promise<number> | undefined;

// the loop holds the caller's `/wake` request open until the queue is empty: Fly's proxy treats the
// open connection as activity and keeps the machine up until there is nothing left to verify
export async function drainReplayQueue(deps: Readonly<ReplayWorkerDeps>): Promise<number> {
  recordWake();

  drainInFlight ??= runDrain(deps);

  try {
    return await drainInFlight;
  } finally {
    drainInFlight = undefined;
  }
}

async function runDrain(deps: Readonly<ReplayWorkerDeps>): Promise<number> {
  const cache = createReplayCache(undefined, (stopError) => {
    deps.logger.error({ err: stopError }, 'replay cache driver stop failed');
  });

  const startedAt = performance.now();
  let drained = 0;

  try {
    for (;;) {
      // the failure conversion is chained inside the span callback, not around it, so
      // `reportUnexpectedError` still runs while the root span it tags the report with is active
      const outcome = await withRootSpan('replay.iteration', () =>
        runReplayIteration(deps, cache).catch((error: unknown) => {
          deps.logger.error({ err: error }, 'replay drain iteration threw unexpectedly');

          reportUnexpectedError(error);
          recordIterationFailure('errored');

          return { kind: 'claimFailed' } as const;
        }),
      );

      if (outcome.kind === 'idle' || outcome.kind === 'claimFailed') {
        break;
      }

      drained += 1;
    }

    recordDrainDuration((performance.now() - startedAt) / 1000);
    recordBacklogClaimed(drained);

    return drained;
  } finally {
    // the last claimed driver stays live past the loop; stopping every held entry keeps a driver
    // from outliving the drain that built it
    cache.stopAll();
  }
}
