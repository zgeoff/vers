import type { DB } from '@vers/db';
import type { SimulationDriver } from '@vers/idle-core';
import { buildSimulationInput } from '@vers/idle-core';
import { createSimulationDriver } from '@vers/idle-core/replay';
import type { Transaction } from 'kysely';
import invariant from 'tiny-invariant';
import { applyVerifiedSegment } from '../apply/apply-verified-segment';
import { parkActivity } from '../dispatch/park-activity';
import { runReplaySegment } from '../dispatch/run-replay-segment';
import { recordIterationFailure } from '../metrics/record-iteration-failure';
import { recordRejection } from '../metrics/record-rejection';
import { recordVerificationLag } from '../metrics/record-verification-lag';
import { rollRewardItems } from '../mint/roll-reward-items';
import { updateReplayAttempts } from '../queue/update-replay-attempts';
import { buildSegmentDuration } from '../replay/build-segment-duration';
import { compareReplaySegment } from '../replay/compare-replay-segment';
import type { ReplayCache } from '../replay/create-replay-cache';
import { findSeedDivergence } from '../replay/find-seed-divergence';
import { isForwardExited } from '../replay/is-forward-exited';
import { loadReplaySegment } from '../replay/load-replay-segment';
import { toWireReplaySegmentInput } from '../replay/to-wire-replay-segment-input';
import type {
  CompareVerdict,
  ReplaySegment,
  ReplayedCheckpoint,
  RewardFact,
} from '../replay/types';
import type { ReplayFrontier } from '../types';
import { rejectActivity } from './reject-activity';
import type { PendingCacheEffect, ReplayIterationOutcome, ReplayWorkerDeps } from './types';
import { updateVerifiedAnchorFromPredecessor } from './update-verified-anchor-from-predecessor';

/**
 * Adjudicates one claimed chain's replay frontier: loads its segment, catches the chain's verified
 * anchor up to a forward-exited predecessor it missed, re-derives the activity's seed on its first
 * verified batch, then dispatches by `simVersion` — the in-process incremental cache for this
 * deploy's own engine, the cross-version provider registry for everything else — and turns the
 * resulting verdict into a cursor-only apply, a confirmed rejection, or a park. Runs inside the
 * caller's transaction, alongside the chain claim it composes with.
 */
export async function runFrontier(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  frontier: Readonly<ReplayFrontier>,
): Promise<ReplayIterationOutcome> {
  const loaded = await loadReplaySegment(trx, frontier);

  if (loaded === undefined) {
    return { kind: 'idle' };
  }

  const reconciledAnchor = await updateVerifiedAnchorFromPredecessor(trx, loaded);

  const segment: ReplaySegment =
    reconciledAnchor === undefined
      ? loaded
      : {
          ...loaded,
          chain: {
            ...loaded.chain,
            verifiedChainIndex: reconciledAnchor.chainIndex,
            verifiedNextSeed: reconciledAnchor.nextSeed,
          },
        };

  const seedDivergence = findSeedDivergence(segment);

  if (seedDivergence !== undefined) {
    return rejectSegment(trx, deps, cache, segment, seedDivergence, 'seed-validation-failed');
  }

  if (segment.activity.simVersion === deps.simVersion) {
    return runFrontierInProcess(trx, deps, cache, segment);
  }

  return runFrontierCrossVersion(trx, deps, cache, segment);
}

interface NextSeedCheckpoint {
  readonly payload: { readonly nextSeed: string };
}

/**
 * The last checkpoint in a stored run's `nextSeed` — the driver's `stopAtState` sanity check. A
 * checkpoint's own `time` resets on every engine restart within a farmed stream, so it can never
 * size a duration to advance to; `rngState` runs forward monotonically across restarts instead.
 * The segment's own checkpoint count is the driver's primary halt; this is only an early exit.
 */
function findStopAtState(checkpoints: ReadonlyArray<NextSeedCheckpoint>): string {
  const last = checkpoints.at(-1);

  invariant(last !== undefined, 'a replayed run always has at least one checkpoint');

  return last.payload.nextSeed;
}

/**
 * A cached driver is a valid resume point only when it sits exactly where the freshly loaded
 * segment says verification left off — its emitted count matches `verifiedHead` and its hash
 * matches the segment's own predecessor hash. Anything else (a stale entry left behind by a
 * concurrent adjudication, or simple drift) is discarded rather than trusted.
 */
function isCacheCurrent(
  entry: Readonly<{ emittedCount: number; lastHash: string }>,
  segment: Readonly<ReplaySegment>,
): boolean {
  return entry.emittedCount === segment.verifiedHead && entry.lastHash === segment.prevHash;
}

async function runFrontierInProcess(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
): Promise<ReplayIterationOutcome> {
  const unverified = segment.checkpoints.slice(segment.verifiedHead);
  const rawCached = cache.get(segment.activity.id);

  const cached =
    rawCached !== undefined && isCacheCurrent(rawCached, segment) ? rawCached : undefined;

  if (rawCached !== undefined && cached === undefined) {
    cache.remove(segment.activity.id);
  }

  const compareContext = buildCompareContext(segment);
  const driver = cached?.driver ?? buildFreshDriver(segment);
  const stopAtState = findStopAtState(segment.checkpoints);

  const duration = buildSegmentDuration(
    segment.activity.appendedTimeMs,
    segment.checkpoints.length,
  );

  const expectedCheckpointCount =
    cached === undefined ? segment.checkpoints.length : unverified.length;

  const advance = await driver.advanceToDuration(duration, stopAtState, expectedCheckpointCount);

  const replayed =
    cached === undefined ? advance.checkpoints.slice(segment.verifiedHead) : advance.checkpoints;

  // A duration-cap trip on this (possibly cached) attempt isn't conclusive — a stale cache entry
  // can produce one too — so it falls through to the same fresh, full-segment confirmation a
  // compare divergence gets, rather than parking on an attempt that never finished comparing.
  const verdict = advance.haltedOnDurationCap
    ? undefined
    : compareReplaySegment(unverified, replayed, compareContext);

  if (verdict?.kind === 'match') {
    return applyMatch(
      trx,
      deps,
      segment,
      replayed,
      driver,
      verdict.rewardFacts,
      verdict.verifiedXPDelta,
    );
  }

  const confirmDriver = buildFreshDriver(segment);

  const confirmAdvance = await confirmDriver.advanceToDuration(
    duration,
    stopAtState,
    segment.checkpoints.length,
  );

  if (confirmAdvance.haltedOnDurationCap) {
    return parkFrontier(trx, deps, cache, segment, 'durationCapExceeded');
  }

  const confirmReplayed = confirmAdvance.checkpoints.slice(segment.verifiedHead);
  const confirmVerdict = compareReplaySegment(unverified, confirmReplayed, compareContext);

  if (confirmVerdict.kind === 'match') {
    cache.remove(segment.activity.id);

    return countFailedAttempt(trx, deps, segment);
  }

  return rejectSegment(trx, deps, cache, segment, confirmVerdict, 'confirmed-on-fresh-replay');
}

async function runFrontierCrossVersion(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
): Promise<ReplayIterationOutcome> {
  const unverified = segment.checkpoints.slice(segment.verifiedHead);
  const job = buildCrossVersionJob(segment);
  const runDeps = { db: trx, privateKey: deps.privateKey, simVersion: deps.simVersion };

  const outcome = await runReplaySegment(runDeps, job);

  if (outcome.kind !== 'replayed') {
    return parkFrontier(trx, deps, cache, segment, outcome.kind);
  }

  const compareContext = buildCompareContext(segment);
  const replayed = outcome.output.checkpoints.slice(segment.verifiedHead);

  // As in the in-process path, a duration-cap trip on this first attempt isn't conclusive on its
  // own — it falls through to the same fresh confirmation dispatch a compare divergence gets.
  const verdict =
    outcome.output.haltedOnDurationCap === true
      ? undefined
      : compareReplaySegment(unverified, replayed, compareContext);

  if (verdict?.kind === 'match') {
    return applyMatch(
      trx,
      deps,
      segment,
      replayed,
      undefined,
      verdict.rewardFacts,
      verdict.verifiedXPDelta,
    );
  }

  const confirmOutcome = await runReplaySegment(runDeps, job);

  if (confirmOutcome.kind !== 'replayed') {
    return parkFrontier(trx, deps, cache, segment, confirmOutcome.kind);
  }

  if (confirmOutcome.output.haltedOnDurationCap === true) {
    return parkFrontier(trx, deps, cache, segment, 'durationCapExceeded');
  }

  const confirmReplayed = confirmOutcome.output.checkpoints.slice(segment.verifiedHead);
  const confirmVerdict = compareReplaySegment(unverified, confirmReplayed, compareContext);

  if (confirmVerdict.kind === 'match') {
    return countFailedAttempt(trx, deps, segment);
  }

  return rejectSegment(trx, deps, cache, segment, confirmVerdict, 'confirmed-on-fresh-replay');
}

async function applyMatch(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  segment: Readonly<ReplaySegment>,
  replayed: ReadonlyArray<ReplayedCheckpoint>,
  driver: SimulationDriver | undefined,
  rewardFacts: ReadonlyArray<RewardFact>,
  verifiedXPDelta: number,
): Promise<ReplayIterationOutcome> {
  const lastReplayed = replayed.at(-1);
  const lastStored = segment.checkpoints.at(-1);

  invariant(
    lastReplayed !== undefined && lastStored !== undefined,
    'a compared segment always has at least one checkpoint',
  );

  const forwardExited = isForwardExited(lastReplayed.type, segment.activity.status);
  const advanceChain = forwardExited && lastStored.version === segment.activity.appendedHead;

  const items = await rollRewardItems(
    { keysServiceURL: deps.keysServiceURL, privateKey: deps.privateKey },
    {
      avatarID: segment.activity.avatarID,
      contentVersion: segment.activity.contentVersion,
      keyVersion: segment.activity.keyVersion,
      rewardFacts,
      scopeID: segment.activity.scopeID,
      scopeType: segment.activity.scopeType,
    },
  );

  const result = await applyVerifiedSegment(trx, {
    activityID: segment.activity.id,
    avatarID: segment.activity.avatarID,
    expectedVerifiedHead: segment.verifiedHead,
    ...(items.length > 0 && { items }),
    verifiedHead: lastStored.version,
    ...(advanceChain && {
      chain: {
        chainIndex: segment.activity.startChainIndex + lastStored.version,
        nextSeed: lastReplayed.nextSeed,
        scopeID: segment.activity.scopeID,
        scopeType: segment.activity.scopeType,
      },
    }),
    xpDelta: verifiedXPDelta,
  });

  if (result.applied) {
    const now = Date.now();

    for (const checkpoint of segment.checkpoints.slice(segment.verifiedHead, lastStored.version)) {
      if (checkpoint.appendedAt !== undefined) {
        recordVerificationLag((now - checkpoint.appendedAt.getTime()) / 1000);
      }
    }
  }

  const effect: PendingCacheEffect =
    result.applied && !forwardExited && driver !== undefined
      ? {
          entry: { driver, emittedCount: lastStored.version, lastHash: lastStored.hash },
          kind: 'set',
        }
      : { kind: 'evict' };

  return { kind: 'matched', pendingCache: { activityID: segment.activity.id, effect } };
}

type RejectionCause = 'confirmed-on-fresh-replay' | 'seed-validation-failed';

async function rejectSegment(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
  divergence: Extract<CompareVerdict, { kind: 'divergence' }>,
  cause: RejectionCause,
): Promise<ReplayIterationOutcome> {
  const message =
    cause === 'seed-validation-failed'
      ? 'replay seed validation failed; rejecting activity'
      : 'replay divergence confirmed on a fresh replay; rejecting activity';

  deps.logger.error(
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      reason: divergence.reason,
      simVersion: segment.activity.simVersion,
      verifiedHead: segment.verifiedHead,
      version: divergence.version,
    },
    message,
  );

  recordRejection('integrity-mismatch');

  await rejectActivity(trx, {
    activityID: segment.activity.id,
    avatarID: segment.activity.avatarID,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
  });

  cache.remove(segment.activity.id);

  return { kind: 'rejected' };
}

async function countFailedAttempt(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  segment: Readonly<ReplaySegment>,
): Promise<ReplayIterationOutcome> {
  const result = await updateReplayAttempts(trx, {
    activityID: segment.activity.id,
  });

  if (result?.quarantined === true) {
    deps.logger.error(
      { activityID: segment.activity.id },
      'replay attempts exhausted; activity quarantined',
    );

    recordIterationFailure('quarantined');

    return { kind: 'quarantined' };
  }

  return { kind: 'unconfirmedDivergence' };
}

async function parkFrontier(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
  reason: 'durationCapExceeded' | 'expired' | 'unknownVersion',
): Promise<ReplayIterationOutcome> {
  const message = pickParkMessage(reason);

  deps.logger.warn(
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      appendedTimeMs: segment.activity.appendedTimeMs,
      checkpointCount: segment.checkpoints.length,
      reason,
      simVersion: segment.activity.simVersion,
      verifiedHead: segment.verifiedHead,
    },
    message,
  );

  const rejectionReason = reason === 'durationCapExceeded' ? 'elapsed-time' : 'version-park';

  recordRejection(rejectionReason);

  await parkActivity(trx, segment.activity.id);

  cache.remove(segment.activity.id);

  return { kind: 'parked', reason };
}

function pickParkMessage(reason: 'durationCapExceeded' | 'expired' | 'unknownVersion'): string {
  if (reason === 'expired') {
    return 'sim version retention expired; parking activity for operator resolution';
  }

  if (reason === 'unknownVersion') {
    return 'sim version unrecognized; parking activity';
  }

  return 'replay duration cap exhausted before the expected checkpoint count; parking activity for operator resolution';
}

function buildFreshDriver(segment: Readonly<ReplaySegment>): SimulationDriver {
  const input = buildSimulationInput(segment.activity);

  return createSimulationDriver(input.activity, input.avatar);
}

function buildCrossVersionJob(segment: Readonly<ReplaySegment>) {
  const input = buildSimulationInput(segment.activity);
  const stopAtState = findStopAtState(segment.checkpoints);

  const duration = buildSegmentDuration(
    segment.activity.appendedTimeMs,
    segment.checkpoints.length,
  );

  return toWireReplaySegmentInput(
    input.activity,
    input.avatar,
    duration,
    segment.activity.simVersion,
    stopAtState,
    segment.checkpoints.length,
  );
}

function buildCompareContext(segment: Readonly<ReplaySegment>) {
  return {
    prevHash: segment.prevHash,
    seed: segment.seed,
    startChainIndex: segment.activity.startChainIndex,
  };
}
