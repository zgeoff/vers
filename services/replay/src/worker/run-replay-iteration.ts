import { claimNextChain } from '../queue/claim-next-chain';
import { findReplayFrontier } from '../queue/find-replay-frontier';
import { updateReplayAttempts } from '../queue/update-replay-attempts';
import type { ReplayCache } from '../replay/create-replay-cache';
import type { ReplayFrontier } from '../types';
import { actOnFrontier } from './act-on-frontier';
import type { ReplayIterationOutcome, ReplayWorkerDeps } from './types';

/**
 * Runs one claim-replay-adjudicate cycle: opens a transaction, claims the highest-priority chain
 * with replay work (`idle` when none), loads its frontier, and adjudicates it. A frontier that
 * throws mid-adjudication rolls the whole attempt back — including the claim — and counts one
 * failed attempt against the activity in a fresh statement outside the rolled-back transaction, so
 * a poisoned transaction never blocks the bookkeeping that quarantines a repeatedly failing
 * stream.
 */
export async function runReplayIteration(
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose evict/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
): Promise<ReplayIterationOutcome> {
  let claimedFrontier: ReplayFrontier | undefined;

  try {
    const outcome = await deps.db.transaction().execute(async (trx) => {
      const chain = await claimNextChain(trx);

      if (chain === undefined) {
        return { kind: 'idle' } as const;
      }

      const frontier = await findReplayFrontier(trx, chain);

      if (frontier === undefined) {
        return { kind: 'idle' } as const;
      }

      claimedFrontier = frontier;

      return actOnFrontier(trx, deps, cache, frontier);
    });

    return applyPendingCacheEffect(cache, outcome);
  } catch (error) {
    return recordIterationFailure(deps, cache, claimedFrontier, error);
  }
}

/**
 * `applyMatch` never touches the cache itself — it returns the mutation it intends, and this
 * applies it only once the iteration's transaction has actually committed, so a commit failure
 * never leaves the cache reporting progress the database never persisted. The pending mutation is
 * an internal handoff between `actOnFrontier` and this caller, so it never reaches the returned
 * outcome.
 */
function applyPendingCacheEffect(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose evict/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  outcome: Readonly<ReplayIterationOutcome>,
): ReplayIterationOutcome {
  if (outcome.kind !== 'matched' || outcome.pendingCache === undefined) {
    return outcome;
  }

  const pendingCache = outcome.pendingCache;

  if (pendingCache.effect.kind === 'evict') {
    cache.evict(pendingCache.activityID);
  } else {
    cache.set(pendingCache.activityID, pendingCache.effect.entry);
  }

  return { kind: 'matched' };
}

async function recordIterationFailure(
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose evict/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  frontier: ReplayFrontier | undefined,
  error: unknown,
): Promise<ReplayIterationOutcome> {
  if (frontier === undefined) {
    throw error;
  }

  deps.logger.error({ activityID: frontier.activityID, err: error }, 'replay iteration failed');
  cache.evict(frontier.activityID);

  const result = await updateReplayAttempts(deps.db, {
    activityID: frontier.activityID,
    status: frontier.status,
    verifiedHead: frontier.verifiedHead,
  });

  if (result?.quarantined === true) {
    deps.logger.error(
      { activityID: frontier.activityID },
      'replay attempts exhausted; activity quarantined',
    );

    return { kind: 'quarantined' };
  }

  return { kind: 'errored' };
}
