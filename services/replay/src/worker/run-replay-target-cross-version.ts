import type { ContentDocument } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { EncounterContent } from '@vers/game-utils';
import { buildSimulationInput } from '@vers/idle-core';
import type { Transaction } from 'kysely';
import { runReplaySegment } from '../dispatch/run-replay-segment';
import { buildSegmentDuration } from '../replay/build-segment-duration';
import { compareReplaySegment } from '../replay/compare-replay-segment';
import type { ReplayCache } from '../replay/create-replay-cache';
import { toWireReplaySegmentInput } from '../replay/to-wire-replay-segment-input';
import type { ReplaySegment } from '../replay/types';
import { applyMatch } from './apply-match';
import { buildCompareContext } from './build-compare-context';
import { countFailedAttempt } from './count-failed-attempt';
import { getStopAtState } from './get-stop-at-state';
import { parkReplayTarget } from './park-replay-target';
import { rejectSegment } from './reject-segment';
import { scheduleReplayRetry } from './schedule-replay-retry';
import type { ReplayIterationOutcome, ReplayWorkerDeps } from './types';

export async function runReplayTargetCrossVersion(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
  document: Readonly<ContentDocument>,
  deadline: AbortSignal,
): Promise<ReplayIterationOutcome> {
  const unverified = segment.unverifiedCheckpoints;
  const job = buildCrossVersionJob(document.encounter, segment);

  const runDeps = {
    db: trx,
    privateKey: deps.privateKey,
    signal: deadline,
    simVersion: deps.simVersion,
  };

  const outcome = await runReplaySegment(runDeps, job);

  deadline.throwIfAborted();

  if (outcome.kind === 'providerUnavailable') {
    return scheduleReplayRetry(trx, deps, cache, segment, 'provider-unavailable');
  }

  if (outcome.kind !== 'replayed') {
    return parkReplayTarget(trx, deps, cache, segment, outcome.kind);
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
    return applyMatch(trx, deps, cache, segment, replayed, undefined, verdict, document, deadline);
  }

  const confirmOutcome = await runReplaySegment(runDeps, job);

  deadline.throwIfAborted();

  if (confirmOutcome.kind === 'providerUnavailable') {
    return scheduleReplayRetry(trx, deps, cache, segment, 'provider-unavailable');
  }

  if (confirmOutcome.kind !== 'replayed') {
    return parkReplayTarget(trx, deps, cache, segment, confirmOutcome.kind);
  }

  if (confirmOutcome.output.haltedOnDurationCap === true) {
    return parkReplayTarget(trx, deps, cache, segment, 'durationCapExceeded');
  }

  const confirmReplayed = confirmOutcome.output.checkpoints.slice(segment.verifiedHead);
  const confirmVerdict = compareReplaySegment(unverified, confirmReplayed, compareContext);

  if (confirmVerdict.kind === 'match') {
    return countFailedAttempt(trx, deps, segment);
  }

  return rejectSegment(trx, deps, cache, segment, confirmVerdict, 'confirmed-on-fresh-replay');
}

function buildCrossVersionJob(
  content: Readonly<EncounterContent>,
  segment: Readonly<ReplaySegment>,
) {
  const input = buildSimulationInput(content, segment.activity);
  const stopAtState = getStopAtState(segment.unverifiedCheckpoints);

  const duration = buildSegmentDuration(
    segment.activity.appendedTimeMs,
    segment.activity.appendedHead,
  );

  return toWireReplaySegmentInput(
    input.activity,
    input.avatar,
    duration,
    segment.activity.simVersion,
    stopAtState,
    segment.activity.appendedHead,
  );
}
