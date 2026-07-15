import type { DB } from '@vers/db';
import type { SimulationDriver } from '@vers/idle-core';
import { createSimulationDriver } from '@vers/idle-core/replay';
import type { Transaction } from 'kysely';
import invariant from 'tiny-invariant';
import { applyVerifiedSegment } from '../apply/apply-verified-segment';
import { parkActivity } from '../dispatch/park-activity';
import { runReplaySegment } from '../dispatch/run-replay-segment';
import { updateReplayAttempts } from '../queue/update-replay-attempts';
import { buildReplaySimulationInput } from '../replay/build-replay-simulation-input';
import { buildSegmentDuration } from '../replay/build-segment-duration';
import { compareReplaySegment } from '../replay/compare-replay-segment';
import type { ReplayCache } from '../replay/create-replay-cache';
import { findSeedDivergence } from '../replay/find-seed-divergence';
import { loadReplaySegment } from '../replay/load-replay-segment';
import { toWireReplaySegmentInput } from '../replay/to-wire-replay-segment-input';
import type { CompareVerdict, ReplaySegment, ReplayedCheckpoint } from '../replay/types';
import { TERMINAL_CHECKPOINT_TYPES } from '../replay/types';
import type { ReplayFrontier } from '../types';
import { rejectActivity } from './reject-activity';
import type { PendingCacheEffect, ReplayIterationOutcome, ReplayWorkerDeps } from './types';

/**
 * Adjudicates one claimed chain's replay frontier: loads its segment, re-derives the activity's
 * seed on its first verified batch, then dispatches by `simVersion` — the in-process incremental
 * cache for this deploy's own engine, the cross-version provider registry for everything else —
 * and turns the resulting verdict into a cursor-only apply, a confirmed rejection, or a park. Runs
 * inside the caller's transaction, alongside the chain claim it composes with.
 */
export async function actOnFrontier(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose evict/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  frontier: Readonly<ReplayFrontier>,
): Promise<ReplayIterationOutcome> {
  const segment = await loadReplaySegment(trx, frontier);

  if (segment === undefined) {
    return { kind: 'idle' };
  }

  const seedDivergence = findSeedDivergence(segment);

  if (seedDivergence !== undefined) {
    return rejectSegment(trx, deps, cache, segment, seedDivergence, 'seed-validation-failed');
  }

  if (segment.activity.simVersion === deps.simVersion) {
    return actInProcess(trx, deps, cache, segment);
  }

  return actCrossVersion(trx, deps, cache, segment);
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

async function actInProcess(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose evict/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
): Promise<ReplayIterationOutcome> {
  const unverified = segment.checkpoints.slice(segment.verifiedHead);
  const rawCached = cache.get(segment.activity.id);

  const cached =
    rawCached !== undefined && isCacheCurrent(rawCached, segment) ? rawCached : undefined;

  if (rawCached !== undefined && cached === undefined) {
    cache.evict(segment.activity.id);
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
  const isMatch =
    !advance.haltedOnDurationCap &&
    compareReplaySegment(unverified, replayed, compareContext).kind === 'match';

  if (isMatch) {
    return applyMatch(trx, segment, replayed, driver);
  }

  const confirmDriver = buildFreshDriver(segment);

  const confirmDuration = buildSegmentDuration(
    segment.activity.appendedTimeMs,
    segment.checkpoints.length,
  );

  const confirmAdvance = await confirmDriver.advanceToDuration(
    confirmDuration,
    stopAtState,
    segment.checkpoints.length,
  );

  if (confirmAdvance.haltedOnDurationCap) {
    return parkFrontier(trx, deps, cache, segment, 'durationCapExceeded');
  }

  const confirmReplayed = confirmAdvance.checkpoints.slice(segment.verifiedHead);
  const confirmVerdict = compareReplaySegment(unverified, confirmReplayed, compareContext);

  if (confirmVerdict.kind === 'match') {
    cache.evict(segment.activity.id);

    return countFailedAttempt(trx, deps, segment);
  }

  return rejectSegment(trx, deps, cache, segment, confirmVerdict, 'confirmed-on-fresh-replay');
}

async function actCrossVersion(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose evict/get/set are its whole point; no readonly form is useful
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
  const isMatch =
    outcome.output.haltedOnDurationCap !== true &&
    compareReplaySegment(unverified, replayed, compareContext).kind === 'match';

  if (isMatch) {
    return applyMatch(trx, segment, replayed, undefined);
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
  segment: Readonly<ReplaySegment>,
  replayed: ReadonlyArray<ReplayedCheckpoint>,
  driver: SimulationDriver | undefined,
): Promise<ReplayIterationOutcome> {
  const lastReplayed = replayed.at(-1);
  const lastStored = segment.checkpoints.at(-1);

  invariant(
    lastReplayed !== undefined && lastStored !== undefined,
    'a compared segment always has at least one checkpoint',
  );

  const isTerminal = TERMINAL_CHECKPOINT_TYPES.has(lastReplayed.type);

  const result = await applyVerifiedSegment(trx, {
    activityID: segment.activity.id,
    avatarID: segment.activity.avatarID,
    expectedVerifiedHead: segment.verifiedHead,
    verifiedHead: lastStored.version,
    ...(isTerminal && {
      chain: {
        chainIndex: segment.activity.startChainIndex + lastStored.version,
        nextSeed: lastReplayed.nextSeed,
        scopeID: segment.activity.scopeID,
        scopeType: segment.activity.scopeType,
      },
    }),
  });

  const effect: PendingCacheEffect =
    result.applied && !isTerminal && driver !== undefined
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose evict/get/set are its whole point; no readonly form is useful
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
    { activityID: segment.activity.id, reason: divergence.reason, version: divergence.version },
    message,
  );

  await rejectActivity(trx, {
    activityID: segment.activity.id,
    avatarID: segment.activity.avatarID,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
  });

  cache.evict(segment.activity.id);

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

    return { kind: 'quarantined' };
  }

  return { kind: 'unconfirmedDivergence' };
}

async function parkFrontier(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose evict/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
  reason: 'durationCapExceeded' | 'expired' | 'unknownVersion',
): Promise<ReplayIterationOutcome> {
  const message = pickParkMessage(reason);

  deps.logger.warn({ activityID: segment.activity.id }, message);

  await parkActivity(trx, segment.activity.id);

  cache.evict(segment.activity.id);

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
  const input = buildReplaySimulationInput(segment.activity);

  return createSimulationDriver(input.activity, input.avatar);
}

function buildCrossVersionJob(segment: Readonly<ReplaySegment>) {
  const input = buildReplaySimulationInput(segment.activity);
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
