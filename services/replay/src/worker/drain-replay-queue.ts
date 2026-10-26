import { reportUnexpectedError } from '@vers/service-runtime';
import { runDrainLoop, withRootSpan } from '@vers/service-utils';
import { recordBacklogClaimed } from '../metrics/record-backlog-claimed';
import { recordDrainDuration } from '../metrics/record-drain-duration';
import { recordIterationFailure } from '../metrics/record-iteration-failure';
import { recordWake } from '../metrics/record-wake';
import type { WakeSource } from '../metrics/record-wake';
import { makeCoalescedDrain } from './make-coalesced-drain';
import { runReplayIteration } from './run-replay-iteration';
import type { ReplayWorkerDeps } from './types';

const requestDrain = makeCoalescedDrain(runDrain);

// the loop holds the caller's `/wake` request open until the queue is empty: Fly's proxy treats the
// open connection as activity and keeps the machine up until there is nothing left to verify
export function drainReplayQueue(
  deps: Readonly<ReplayWorkerDeps>,
  source: WakeSource,
): Promise<number> {
  recordWake(source);

  return requestDrain(deps);
}

async function runDrain(deps: Readonly<ReplayWorkerDeps>): Promise<number> {
  const startedAt = performance.now();

  const claimed = await runDrainLoop(async () => {
    // the failure conversion is chained inside the span callback, not around it, so
    // `reportUnexpectedError` still runs while the root span it tags the report with is active
    const outcome = await withRootSpan('replay.iteration', () =>
      runReplayIteration(deps, deps.cache).catch((error: unknown) => {
        deps.logger.error('replay drain iteration threw unexpectedly', { error });

        reportUnexpectedError(error);
        recordIterationFailure('errored');

        return { kind: 'claimFailed' } as const;
      }),
    );

    return outcome.kind === 'idle' || outcome.kind === 'claimFailed' ? null : outcome;
  });

  recordDrainDuration((performance.now() - startedAt) / 1000);
  recordBacklogClaimed(claimed.length);

  return claimed.length;
}
