import { reportUnexpectedError } from '@vers/service-runtime';
import { runDrainLoop, withRootSpan } from '@vers/service-utils';
import { sql } from 'kysely';
import { recordBacklogClaimed } from '../metrics/record-backlog-claimed';
import { recordDrainDuration } from '../metrics/record-drain-duration';
import { recordIterationFailure } from '../metrics/record-iteration-failure';
import { recordReplayFlagRepair } from '../metrics/record-replay-flag-repair';
import { recordWake } from '../metrics/record-wake';
import type { WakeSource } from '../metrics/record-wake';
import { updateReplayPendingChains } from '../queue/update-replay-pending-chains';
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

  // a writer that skips the flag, such as an activity service older than the flag or an append
  // racing a settlement, still sends a wake, so the drain it starts finds that chain here
  const isRepaired = await withRootSpan('replay.flag_repair', () =>
    deps.db
      .transaction()
      .execute(async (trx) => {
        // the planner prices the pass above jit_above_cost, and compiling it took 160 ms of a
        // 225 ms pass at 800 avatars on Postgres 16
        await sql`set local jit = off`.execute(trx);

        return updateReplayPendingChains(trx, undefined);
      })
      .then(
        (repaired) => {
          recordReplayFlagRepair('flagged', repaired.flagged);
          recordReplayFlagRepair('cleared', repaired.cleared);

          return true;
        },
        (error: unknown) => {
          deps.logger.error('replay flag repair failed', { error });

          reportUnexpectedError(error);

          return false;
        },
      ),
  );

  // a failed repair ends the drain as a failed claim does, and the next wake runs both again
  const claimed = isRepaired ? await runClaimLoop(deps) : [];

  recordDrainDuration((performance.now() - startedAt) / 1000);
  recordBacklogClaimed(claimed.length);

  return claimed.length;
}

function runClaimLoop(deps: Readonly<ReplayWorkerDeps>): Promise<ReadonlyArray<unknown>> {
  return runDrainLoop(async () => {
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
}
