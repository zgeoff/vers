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
    return await deps.db.transaction().execute(async (trx) => {
      const chain = await claimNextChain(trx);

      if (chain === undefined) {
        return { kind: 'idle' };
      }

      const frontier = await findReplayFrontier(trx, chain);

      if (frontier === undefined) {
        return { kind: 'idle' };
      }

      claimedFrontier = frontier;

      return actOnFrontier(trx, deps, cache, frontier);
    });
  } catch (error) {
    return recordIterationFailure(deps, cache, claimedFrontier, error);
  }
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

  deps.logger.error({ activityID: frontier.activityID, error }, 'replay iteration failed');
  cache.evict(frontier.activityID);

  const result = await updateReplayAttempts(deps.db, { activityID: frontier.activityID });

  if (result?.quarantined === true) {
    deps.logger.error(
      { activityID: frontier.activityID },
      'replay attempts exhausted; activity quarantined',
    );

    return { kind: 'quarantined' };
  }

  return { kind: 'errored' };
}
