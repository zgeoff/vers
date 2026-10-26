import type { ContentDocument } from '@vers/contract-activity';
import type { EncounterContent } from '@vers/game-utils';
import type { SimulationDriver } from '@vers/idle-core';
import { buildSimulationInput } from '@vers/idle-core';
import { createSimulationDriver } from '@vers/idle-core/replay';
import { recordCacheLookup } from '../metrics/record-cache-lookup';
import type { CacheLookupOutcome } from '../metrics/record-cache-lookup';
import { buildSegmentDuration } from '../replay/build-segment-duration';
import { compareReplaySegment } from '../replay/compare-replay-segment';
import type { ReplaySegment } from '../replay/types';
import { applyMatch } from './apply-match';
import { buildCompareContext } from './build-compare-context';
import { countFailedAttempt } from './count-failed-attempt';
import { getStopAtState } from './get-stop-at-state';
import { parkReplayTarget } from './park-replay-target';
import { rejectSegment } from './reject-segment';
import type { ReplayIterationOutcome, ReplayTargetContext } from './types';

export async function runReplayTargetInProcess(
  context: ReplayTargetContext,
  segment: Readonly<ReplaySegment>,
  document: Readonly<ContentDocument>,
  deadline: AbortSignal,
): Promise<ReplayIterationOutcome> {
  const cache = context.cache;
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
    return applyMatch(context, segment, { deadline, document, driver, replayed, verdict });
  }

  const confirmDriver = buildFreshDriver(document.encounter, segment);

  const confirmAdvance = await confirmDriver.advanceToDuration(
    duration,
    stopAtState,
    segment.activity.appendedHead,
  );

  deadline.throwIfAborted();

  if (confirmAdvance.haltedOnDurationCap) {
    return parkReplayTarget(context, segment, 'durationCapExceeded');
  }

  const confirmReplayed = confirmAdvance.checkpoints.slice(segment.verifiedHead);
  const confirmVerdict = compareReplaySegment(unverified, confirmReplayed, compareContext);

  if (confirmVerdict.kind === 'match') {
    cache.remove(segment.activity.id);

    return countFailedAttempt(context.trx, segment);
  }

  return rejectSegment(context, segment, confirmVerdict, 'confirmed-on-fresh-replay');
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
