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
import { TERMINAL_CHECKPOINT_TYPES, compareReplaySegment } from '../replay/compare-replay-segment';
import type { ReplayCache } from '../replay/create-replay-cache';
import { findSeedDivergence } from '../replay/find-seed-divergence';
import { loadReplaySegment } from '../replay/load-replay-segment';
import { toWireReplaySegmentInput } from '../replay/to-wire-replay-segment-input';
import type { CompareVerdict, ReplaySegment, ReplayedCheckpoint } from '../replay/types';
import type { ReplayFrontier } from '../types';
import { rejectActivity } from './reject-activity';
import type { ReplayIterationOutcome, ReplayWorkerDeps } from './types';

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

  invariant(segment !== undefined, 'a claimed frontier always has a loadable segment');

  const seedDivergence = findSeedDivergence(segment);

  if (seedDivergence !== undefined) {
    return rejectSegment(trx, deps, cache, segment, seedDivergence);
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
 * The last checkpoint in a stored run's `nextSeed` — the driver's `stopAtState` target. A
 * checkpoint's own `time` resets on every engine restart within a farmed stream, so it can never
 * size a duration to advance to; `rngState` runs forward monotonically across restarts instead,
 * so stopping there reproduces exactly the run's checkpoints regardless of how many local attempts
 * it spans. `duration` is only the safety cap behind it.
 */
function findStopAtState(checkpoints: ReadonlyArray<NextSeedCheckpoint>): string {
  const last = checkpoints.at(-1);

  invariant(last !== undefined, 'a replayed run always has at least one checkpoint');

  return last.payload.nextSeed;
}

async function actInProcess(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose evict/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
): Promise<ReplayIterationOutcome> {
  const unverified = segment.checkpoints.slice(segment.verifiedHead);
  const cached = cache.get(segment.activity.id);
  const compareContext = buildCompareContext(segment);
  const driver = cached?.driver ?? buildFreshDriver(segment);
  const stopAtState = findStopAtState(segment.checkpoints);

  const duration =
    cached === undefined
      ? buildSegmentDuration(segment.checkpoints)
      : driver.elapsed + buildSegmentDuration(unverified);

  const emitted = await driver.advanceToDuration(duration, stopAtState);

  const replayed = cached === undefined ? emitted.slice(segment.verifiedHead) : emitted;
  const verdict = compareReplaySegment(unverified, replayed, compareContext);

  if (verdict.kind === 'match') {
    return applyMatch(trx, cache, segment, replayed, driver);
  }

  const confirmDriver = buildFreshDriver(segment);
  const confirmDuration = buildSegmentDuration(segment.checkpoints);

  const confirmEmitted = await confirmDriver.advanceToDuration(confirmDuration, stopAtState);

  const confirmReplayed = confirmEmitted.slice(segment.verifiedHead);
  const confirmVerdict = compareReplaySegment(unverified, confirmReplayed, compareContext);

  if (confirmVerdict.kind === 'match') {
    cache.evict(segment.activity.id);

    return countFailedAttempt(trx, deps, segment.activity.id);
  }

  return rejectSegment(trx, deps, cache, segment, confirmVerdict);
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
  const verdict = compareReplaySegment(unverified, replayed, compareContext);

  if (verdict.kind === 'match') {
    return applyMatch(trx, cache, segment, replayed, undefined);
  }

  const confirmOutcome = await runReplaySegment(runDeps, job);

  invariant(
    confirmOutcome.kind === 'replayed',
    'a version resolved once resolves the same way again inside one iteration',
  );

  const confirmReplayed = confirmOutcome.output.checkpoints.slice(segment.verifiedHead);
  const confirmVerdict = compareReplaySegment(unverified, confirmReplayed, compareContext);

  if (confirmVerdict.kind === 'match') {
    return countFailedAttempt(trx, deps, segment.activity.id);
  }

  return rejectSegment(trx, deps, cache, segment, confirmVerdict);
}

async function applyMatch(
  trx: Transaction<DB>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose evict/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
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

  if (result.applied && !isTerminal && driver !== undefined) {
    cache.set(segment.activity.id, {
      driver,
      emittedCount: lastStored.version,
      lastHash: lastStored.hash,
    });
  } else {
    cache.evict(segment.activity.id);
  }

  return { kind: 'matched' };
}

async function rejectSegment(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose evict/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
  divergence: Extract<CompareVerdict, { kind: 'divergence' }>,
): Promise<ReplayIterationOutcome> {
  deps.logger.error(
    { activityID: segment.activity.id, reason: divergence.reason, version: divergence.version },
    'replay divergence confirmed on a fresh replay; rejecting activity',
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
  activityID: string,
): Promise<ReplayIterationOutcome> {
  const result = await updateReplayAttempts(trx, { activityID });

  if (result?.quarantined === true) {
    deps.logger.error({ activityID }, 'replay attempts exhausted; activity quarantined');

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
  reason: 'expired' | 'unknownVersion',
): Promise<ReplayIterationOutcome> {
  const message =
    reason === 'expired'
      ? 'sim version retention expired; parking activity for operator resolution'
      : 'sim version unrecognized; parking activity';

  deps.logger.warn({ activityID: segment.activity.id }, message);

  await parkActivity(trx, segment.activity.id);

  cache.evict(segment.activity.id);

  return { kind: 'parked', reason };
}

function buildFreshDriver(segment: Readonly<ReplaySegment>): SimulationDriver {
  const input = buildReplaySimulationInput(segment.activity);

  return createSimulationDriver(input.activity, input.avatar);
}

function buildCrossVersionJob(segment: Readonly<ReplaySegment>) {
  const input = buildReplaySimulationInput(segment.activity);
  const stopAtState = findStopAtState(segment.checkpoints);
  const duration = buildSegmentDuration(segment.checkpoints);

  return toWireReplaySegmentInput(
    input.activity,
    input.avatar,
    duration,
    segment.activity.simVersion,
    stopAtState,
  );
}

function buildCompareContext(segment: Readonly<ReplaySegment>) {
  return {
    prevHash: segment.prevHash,
    seed: segment.seed,
    startChainIndex: segment.activity.startChainIndex,
  };
}
