import { reportUnexpectedError } from '@vers/service-runtime';
import { recordIterationFailure } from '../metrics/record-iteration-failure';
import { claimNextSeedChain } from '../queue/claim-next-seed-chain';
import { findReplayTarget } from '../queue/find-replay-target';
import { updateReplayAttempts } from '../queue/update-replay-attempts';
import type { ReplayCache } from '../replay/create-replay-cache';
import type { ReplayTarget } from '../types';
import { runReplayTarget } from './run-replay-target';
import type { ReplayIterationOutcome, ReplayWorkerDeps } from './types';

/**
 * Runs one claim-replay-adjudicate cycle: opens a transaction, claims the highest-priority avatar's
 * next-in-order activity with replay work (`idle` when none), loads its target, and adjudicates
 * it. A target that throws mid-adjudication rolls the whole attempt back — including the claim —
 * and counts one failed attempt against the activity in a fresh statement outside the rolled-back
 * transaction, so a poisoned transaction never blocks the bookkeeping that quarantines a repeatedly
 * failing stream.
 */
export async function runReplayIteration(
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
): Promise<ReplayIterationOutcome> {
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

      return runReplayTarget(trx, deps, cache, target);
    });

    return applyPendingCacheEffect(cache, outcome);
  } catch (error) {
    return resolveIterationFailure(deps, cache, claimedTarget, error);
  }
}

/**
 * The cache mutation a matched, non-terminal segment intends is never applied by the target
 * adjudication itself — it returns the mutation it intends, and this applies it only once the
 * iteration's transaction has actually committed, so a commit failure never leaves the cache
 * reporting progress the database never persisted. The pending mutation is an internal handoff
 * between that adjudication and this caller, so it never reaches the returned outcome.
 */
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

async function resolveIterationFailure(
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  target: ReplayTarget | undefined,
  error: unknown,
): Promise<ReplayIterationOutcome> {
  if (target === undefined) {
    throw error;
  }

  deps.logger.error({ activityID: target.activityID, err: error }, 'replay iteration failed');

  reportUnexpectedError(error);

  cache.remove(target.activityID);

  const result = await updateReplayAttempts(deps.db, {
    activityID: target.activityID,
    status: target.status,
    verifiedHead: target.verifiedHead,
  });

  if (result?.quarantined === true) {
    deps.logger.error(
      { activityID: target.activityID },
      'replay attempts exhausted; activity quarantined',
    );

    recordIterationFailure('quarantined');

    return { kind: 'quarantined' };
  }

  recordIterationFailure('errored');

  return { kind: 'errored' };
}
