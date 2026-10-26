import type { ContentDocument } from '@vers/contract-activity';
import type { EncounterContent } from '@vers/game-utils';
import { buildSimulationInput } from '@vers/idle-core';
import { runReplaySegment } from '../dispatch/run-replay-segment';
import { buildSegmentDuration } from '../replay/build-segment-duration';
import { compareReplaySegment } from '../replay/compare-replay-segment';
import { toWireReplaySegmentInput } from '../replay/to-wire-replay-segment-input';
import type { ReplaySegment } from '../replay/types';
import { applyMatch } from './apply-match';
import { buildCompareContext } from './build-compare-context';
import { countFailedAttempt } from './count-failed-attempt';
import { getStopAtState } from './get-stop-at-state';
import { parkReplayTarget } from './park-replay-target';
import { rejectSegment } from './reject-segment';
import { scheduleReplayRetry } from './schedule-replay-retry';
import type { ReplayIterationOutcome, ReplayTargetContext } from './types';

export async function runReplayTargetCrossVersion(
  context: ReplayTargetContext,
  segment: Readonly<ReplaySegment>,
  document: Readonly<ContentDocument>,
  deadline: AbortSignal,
): Promise<ReplayIterationOutcome> {
  const unverified = segment.unverifiedCheckpoints;
  const job = buildCrossVersionJob(document.encounter, segment);

  const runDeps = {
    db: context.trx,
    privateKey: context.deps.privateKey,
    signal: deadline,
    simVersion: context.deps.simVersion,
  };

  const outcome = await runReplaySegment(runDeps, job);

  deadline.throwIfAborted();

  if (outcome.kind === 'providerUnavailable') {
    return scheduleReplayRetry(context, segment, 'provider-unavailable');
  }

  if (outcome.kind !== 'replayed') {
    return parkReplayTarget(context, segment, outcome.kind);
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
    return applyMatch(context, segment, {
      deadline,
      document,
      driver: undefined,
      replayed,
      verdict,
    });
  }

  const confirmOutcome = await runReplaySegment(runDeps, job);

  deadline.throwIfAborted();

  if (confirmOutcome.kind === 'providerUnavailable') {
    return scheduleReplayRetry(context, segment, 'provider-unavailable');
  }

  if (confirmOutcome.kind !== 'replayed') {
    return parkReplayTarget(context, segment, confirmOutcome.kind);
  }

  if (confirmOutcome.output.haltedOnDurationCap === true) {
    return parkReplayTarget(context, segment, 'durationCapExceeded');
  }

  const confirmReplayed = confirmOutcome.output.checkpoints.slice(segment.verifiedHead);
  const confirmVerdict = compareReplaySegment(unverified, confirmReplayed, compareContext);

  if (confirmVerdict.kind === 'match') {
    return countFailedAttempt(context.trx, segment);
  }

  return rejectSegment(context, segment, confirmVerdict, 'confirmed-on-fresh-replay');
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

  return toWireReplaySegmentInput({
    activity: input.activity,
    avatar: input.avatar,
    duration,
    simVersion: segment.activity.simVersion,
    stopAtState,
    expectedCheckpointCount: segment.activity.appendedHead,
  });
}
