import type { ContentDocument } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { EncounterContent } from '@vers/game-utils';
import type { SimulationDriver } from '@vers/idle-core';
import { buildSimulationInput } from '@vers/idle-core';
import { createSimulationDriver } from '@vers/idle-core/replay';
import type { Transaction } from 'kysely';
import { recordCacheLookup } from '../metrics/record-cache-lookup';
import type { CacheLookupOutcome } from '../metrics/record-cache-lookup';
import { buildSegmentDuration } from '../replay/build-segment-duration';
import { compareReplaySegment } from '../replay/compare-replay-segment';
import type { ReplayCache } from '../replay/create-replay-cache';
import type { ReplaySegment } from '../replay/types';
import { applyMatch } from './apply-match';
import { buildCompareContext } from './build-compare-context';
import { countFailedAttempt } from './count-failed-attempt';
import { getStopAtState } from './get-stop-at-state';
import { parkReplayTarget } from './park-replay-target';
import { rejectSegment } from './reject-segment';
import type { ReplayIterationOutcome, ReplayWorkerDeps } from './types';

export async function runReplayTargetInProcess(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
  document: Readonly<ContentDocument>,
  deadline: AbortSignal,
): Promise<ReplayIterationOutcome> {
  const unverified = segment.unverifiedCheckpoints;
  const rawCached = cache.get(segment.activity.id);
  const cacheIsCurrent = rawCached !== undefined && isCacheCurrent(rawCached, segment);

  recordCacheLookup(pickCacheLookupOutcome(rawCached, cacheIsCurrent));

  const cached = cacheIsCurrent ? rawCached : undefined;

  if (rawCached !== undefined && cached === undefined) {
    cache.remove(segment.activity.id);
  }

  const compareContext = buildCompareContext(segment);
  const driver = cached?.driver ?? buildFreshDriver(document.encounter, segment);
  const stopAtState = getStopAtState(segment.unverifiedCheckpoints);

  const duration = buildSegmentDuration(
    segment.activity.appendedTimeMs,
    segment.activity.appendedHead,
  );

  const expectedCheckpointCount =
    cached === undefined ? segment.activity.appendedHead : unverified.length;

  const advance = await driver.advanceToDuration(duration, stopAtState, expectedCheckpointCount);

  deadline.throwIfAborted();

  const replayed =
    cached === undefined ? advance.checkpoints.slice(segment.verifiedHead) : advance.checkpoints;

  // A duration-cap trip on this (possibly cached) attempt isn't conclusive — a stale cache entry
  // can produce one too — so it falls through to the same fresh, full-segment confirmation a
  // compare divergence gets, rather than parking on an attempt that never finished comparing.
  const verdict = advance.haltedOnDurationCap
    ? undefined
    : compareReplaySegment(unverified, replayed, compareContext);

  if (verdict?.kind === 'match') {
    return applyMatch(trx, deps, cache, segment, replayed, driver, verdict, document, deadline);
  }

  const confirmDriver = buildFreshDriver(document.encounter, segment);

  const confirmAdvance = await confirmDriver.advanceToDuration(
    duration,
    stopAtState,
    segment.activity.appendedHead,
  );

  deadline.throwIfAborted();

  if (confirmAdvance.haltedOnDurationCap) {
    return parkReplayTarget(trx, deps, cache, segment, 'durationCapExceeded');
  }

  const confirmReplayed = confirmAdvance.checkpoints.slice(segment.verifiedHead);
  const confirmVerdict = compareReplaySegment(unverified, confirmReplayed, compareContext);

  if (confirmVerdict.kind === 'match') {
    cache.remove(segment.activity.id);

    return countFailedAttempt(trx, deps, segment);
  }

  return rejectSegment(trx, deps, cache, segment, confirmVerdict, 'confirmed-on-fresh-replay');
}

function isCacheCurrent(
  entry: Readonly<{ emittedCount: number; lastHash: string }>,
  segment: Readonly<ReplaySegment>,
): boolean {
  return entry.emittedCount === segment.verifiedHead && entry.lastHash === segment.prevHash;
}

function pickCacheLookupOutcome(
  rawCached: Readonly<{ emittedCount: number; lastHash: string }> | undefined,
  cacheIsCurrent: boolean,
): CacheLookupOutcome {
  if (rawCached === undefined) {
    return 'miss';
  }

  return cacheIsCurrent ? 'hit' : 'stale';
}

function buildFreshDriver(
  content: Readonly<EncounterContent>,
  segment: Readonly<ReplaySegment>,
): SimulationDriver {
  const input = buildSimulationInput(content, segment.activity);

  return createSimulationDriver(input.activity, input.avatar);
}
