import { reportUnexpectedError } from '@vers/service-runtime';
import { recordBackoff } from '../metrics/record-backoff';
import { recordIterationFailure } from '../metrics/record-iteration-failure';
import { claimNextSeedChain } from '../queue/claim-next-seed-chain';
import { findReplayTarget } from '../queue/find-replay-target';
import { updateReplayBackoff } from '../queue/update-replay-backoff';
import type { ReplayCache } from '../replay/create-replay-cache';
import type { ReplayTarget } from '../types';
import { runReplayTarget } from './run-replay-target';
import type { ReplayIterationOutcome, ReplayWorkerDeps } from './types';

const DEFAULT_ITERATION_DEADLINE_MS = 90_000;

export async function runReplayIteration(
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
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

      const target = await findReplayTarget(trx, claimed.activityID);

      if (target === undefined) {
        return { kind: 'idle' } as const;
      }

      claimedTarget = target;

      return runReplayTarget(trx, deps, cache, target, deadline);
    });

    return applyPendingCacheEffect(cache, outcome);
  } catch (error) {
    return resolveIterationFailure(deps, cache, claimedTarget, error, deadline, deadlineMs);
  }
}

function applyPendingCacheEffect(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
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
async function resolveIterationFailure(
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  target: ReplayTarget | undefined,
  error: unknown,
  deadline: AbortSignal,
  deadlineMs: number,
): Promise<ReplayIterationOutcome> {
  if (target === undefined) {
    throw error;
  }

  cache.remove(target.activityID);

  if (deadline.aborted) {
    const backoff = await updateReplayBackoff(deps.db, {
      activityID: target.activityID,
      verifiedHead: target.verifiedHead,
    });

    deps.logger.warn(
      { activityID: target.activityID, deadlineMs, ...backoff },
      'replay iteration deadline fired; backing the activity off',
    );

    recordBackoff('deadline');

    return { kind: 'backedOff', reason: 'deadline' };
  }

  const backoff = await updateReplayBackoff(deps.db, {
    activityID: target.activityID,
    verifiedHead: target.verifiedHead,
  });

  deps.logger.error(
    { activityID: target.activityID, err: error, ...backoff },
    'replay iteration failed; backing the activity off',
  );

  reportUnexpectedError(error);
  recordIterationFailure('errored');
  recordBackoff('errored');

  return { kind: 'backedOff', reason: 'errored' };
}
