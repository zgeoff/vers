import { reportUnexpectedError } from '@vers/service-runtime';
import { recordBackoff } from '../metrics/record-backoff';
import { recordIterationFailure } from '../metrics/record-iteration-failure';
import { claimNextSeedChain } from '../queue/claim-next-seed-chain';
import { readReplayTarget } from '../queue/read-replay-target';
import { updateReplayBackoff } from '../queue/update-replay-backoff';
import { updateReplayPendingChains } from '../queue/update-replay-pending-chains';
import type { ReplayCache } from '../replay/create-replay-cache';
import type { ReplayTarget } from '../types';
import { runReplayTarget } from './run-replay-target';
import type { ReplayIterationOutcome, ReplayWorkerDeps } from './types';
import { writeHoldLine } from './write-hold-line';

const DEFAULT_ITERATION_DEADLINE_MS = 90_000;

export async function runReplayIteration(
  deps: Readonly<ReplayWorkerDeps>,
  cache: ReplayCache,
): Promise<ReplayIterationOutcome> {
  const deadlineMs = deps.iterationDeadlineMs ?? DEFAULT_ITERATION_DEADLINE_MS;
  const deadline = AbortSignal.timeout(deadlineMs);
  let claimedTarget: ReplayTarget | undefined;

  try {
    const outcome = await deps.db.transaction().execute(async (trx) => {
      const claimed = await claimNextSeedChain(trx);

      if (claimed === undefined) {
        return { kind: 'idle' } as const;
      }

      const target = await readReplayTarget(trx, claimed.activityID);

      claimedTarget = target;

      const replayed =
        target === undefined
          ? ({ kind: 'idle' } as const)
          : await runReplayTarget({ trx, deps, cache }, target, deadline);

      await updateReplayPendingChains(trx, claimed.avatarID);

      return replayed;
    });

    writeHoldLine(deps.logger, outcome);

    return applyPendingCacheEffect(cache, outcome);
  } catch (error) {
    return resolveIterationFailure(deps, cache, {
      deadline,
      deadlineMs,
      error,
      target: claimedTarget,
    });
  }
}

function applyPendingCacheEffect(
  cache: ReplayCache,
  outcome: Readonly<ReplayIterationOutcome>,
): ReplayIterationOutcome {
  if (outcome.kind !== 'matched' || outcome.pendingCache === undefined) {
    return outcome;
  }

  const pendingCache = outcome.pendingCache;

  if (pendingCache.effect.kind === 'evict') {
    cache.remove(pendingCache.activityID);
  } else {
    cache.set(pendingCache.activityID, pendingCache.effect.entry);
  }

  return { kind: 'matched' };
}

// the transaction has already rolled back by the time this runs, so the backoff lands on its own
// connection and survives whatever the iteration left half-done
interface IterationFailure {
  readonly deadline: AbortSignal;
  readonly deadlineMs: number;
  readonly error: unknown;
  readonly target: ReplayTarget | undefined;
}

async function resolveIterationFailure(
  deps: Readonly<ReplayWorkerDeps>,
  cache: ReplayCache,
  failure: IterationFailure,
): Promise<ReplayIterationOutcome> {
  const target = failure.target;
  const error = failure.error;

  if (target === undefined) {
    throw error;
  }

  cache.remove(target.activityID);

  if (failure.deadline.aborted) {
    const backoff = await updateReplayBackoff(deps.db, {
      activityID: target.activityID,
      verifiedHead: target.verifiedHead,
    });

    deps.logger.warn('replay iteration deadline fired; backing the activity off', {
      activityID: target.activityID,
      deadlineMs: failure.deadlineMs,
      ...backoff,
    });

    recordBackoff('deadline');

    return { kind: 'backedOff', reason: 'deadline' };
  }

  const backoff = await updateReplayBackoff(deps.db, {
    activityID: target.activityID,
    verifiedHead: target.verifiedHead,
  });

  deps.logger.error('replay iteration failed; backing the activity off', {
    activityID: target.activityID,
    error,
    ...backoff,
  });

  reportUnexpectedError(error);
  recordIterationFailure('errored');
  recordBackoff('errored');

  return { kind: 'backedOff', reason: 'errored' };
}
