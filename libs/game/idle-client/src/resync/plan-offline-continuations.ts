import { createId } from '@paralleldrive/cuid2';
import type { CatchUpContinuation, CheckpointBatchEntry } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import type {
  ActivityCheckpoint,
  ActivityInput,
  AvatarData,
  SimulationInputSource,
} from '@vers/idle-core';
import {
  ActivityCheckpointType,
  ActivityFailureAction,
  buildLevelFromXP,
  foldOptimisticBuild,
  runAttempt,
} from '@vers/idle-core';
import invariant from 'tiny-invariant';
import { buildCheckpointBatchEntry } from '../submission/build-checkpoint-batch-entry';
import { ENTROPY_SOURCE_SERVER_KEY } from '../submission/constants';
import type { LatestActivityProgress } from './types';

export interface PlannedContinuation {
  readonly continuation: CatchUpContinuation;
  readonly levelUps: number;
}

interface PlanOfflineContinuationsOptions {
  readonly budgetMs: number;

  /**
   * Derives the engine's simulation input and avatar from a chain-position source — the real
   * confirmed row for the gap's first attempt, a client-predicted one for every attempt after.
   */
  readonly buildSimulationInput: (source: Readonly<SimulationInputSource>) => {
    activity: ActivityInput;
    avatar: AvatarData;
  };

  readonly progress: Readonly<LatestActivityProgress>;
}

export interface PlanOfflineContinuationsResult {
  readonly planned: ReadonlyArray<PlannedContinuation>;
  readonly reason: 'aborted-on-failure' | 'budget-exhausted';
}

/**
 * Simulates an entire offline gap locally, instantly: no network call, no submitter. Attempt by
 * attempt, it reconstructs the confirmed row's own remaining tail for free (the already-appended
 * prefix costs nothing against the budget), then — while budget remains and the failure policy
 * allows it — derives each further attempt's seed, client id, and predicted build snapshot from
 * the chain position alone, exactly as `advanceActivity` reproduces them server-side. Prediction
 * depends on the single-active-run invariant: no other scope accrues unsettled xp during the gap,
 * so the confirmed row's own snapshot is the correct baseline for every later attempt's fold, and
 * the only sources this loop must add are the gap's own continuations as they close. A failure
 * under the abort policy stops planning after that continuation's own tail — the same policy
 * `pickPostTerminalAction` applies live — so no further continuation is planned past it, and its
 * own mint step lands a fresh, unplayed row exactly as an aborted online failure would leave one
 * ready for the player's next explicit start.
 */
export async function planOfflineContinuations(
  options: Readonly<PlanOfflineContinuationsOptions>,
): Promise<PlanOfflineContinuationsResult> {
  let remainingMs = options.budgetMs;
  let appendedHead = options.progress.appendedHead;
  const activity = options.progress.activity;

  let cursor: OfflineRowCursor = {
    buildSnapshot: activity.buildSnapshot,
    id: activity.id,
    lastHash: activity.lastHash,
    seed: activity.seed,
    startChainIndex: activity.startChainIndex,
  };

  // The chain's shared baseline: the confirmed row's own snapshot already bakes in every
  // other-scope unsettled activity, so only this gap's own continuations add further sources as
  // they close.
  const baselineXP = activity.buildSnapshot.xp;
  const localSources: Array<OfflineOptimisticSource> = [];
  const planned: Array<PlannedContinuation> = [];

  for (;;) {
    const source: SimulationInputSource = {
      avatarID: activity.avatarID,
      buildSnapshot: cursor.buildSnapshot,
      contentVersion: activity.contentVersion,
      encounterNode: activity.encounterNode,
      id: cursor.id,
      seed: cursor.seed,
    };

    const input = options.buildSimulationInput(source);

    // A reconstruction must reach its terminal to reconcile, whatever the budget — its prefix is
    // already accounted server-side, so only the tail is priced against the budget below.
    const ceilingMs = appendedHead > 0 ? Number.MAX_SAFE_INTEGER : remainingMs;

    const attempt = await runAttempt(input.activity, input.avatar, { maxDurationMs: ceilingMs });

    if (attempt.outcome === 'exceeded-budget') {
      return { planned, reason: 'budget-exhausted' };
    }

    const lastCheckpoint = attempt.checkpoints.at(-1);
    const lastAppended = appendedHead > 0 ? attempt.checkpoints[appendedHead - 1] : undefined;
    const tailTimeMs = (lastCheckpoint?.time ?? 0) - (lastAppended?.time ?? 0);

    if (tailTimeMs > remainingMs) {
      return { planned, reason: 'budget-exhausted' };
    }

    const tail = attempt.checkpoints.slice(appendedHead);
    const checkpoints = buildTailEntries(cursor, appendedHead, tail, lastAppended?.nextSeed);
    const lastEntry = checkpoints.at(-1);

    invariant(lastEntry !== undefined, 'a terminal attempt always carries at least one checkpoint');

    remainingMs -= tailTimeMs;

    const nextID = `act_${createId()}`;
    const nextStartKey = `continue_${cursor.id}`;

    localSources.push({
      id: cursor.id,
      settledXP: 0,
      tailPayload: lastEntry.payload,
      unverifiedDeltaSum: 0,
    });

    const optimistic = foldOptimisticBuild(baselineXP, localSources);

    const nextBuildSnapshot = {
      level: buildLevelFromXP(optimistic.totalXP),
      xp: optimistic.totalXP,
    };

    planned.push({
      continuation: {
        buildSnapshot: nextBuildSnapshot,
        checkpoints,
        id: nextID,
        startKey: nextStartKey,
      },
      levelUps: countLevelUps(tail),
    });

    if (
      attempt.outcome === 'failed' &&
      input.activity.failureAction === ActivityFailureAction.Abort
    ) {
      return { planned, reason: 'aborted-on-failure' };
    }

    if (remainingMs <= 0) {
      return { planned, reason: 'budget-exhausted' };
    }

    cursor = {
      buildSnapshot: nextBuildSnapshot,
      id: nextID,
      lastHash: buildStartHash({
        contentVersion: activity.contentVersion,
        encounterNode: activity.encounterNode,
        keyVersion: activity.keyVersion,
        seed: lastEntry.payload.nextSeed,
        simVersion: activity.simVersion,
      }),
      seed: lastEntry.payload.nextSeed,
      startChainIndex: cursor.startChainIndex + lastEntry.version,
    };

    appendedHead = 0;
  }
}

interface OfflineRowCursor {
  readonly buildSnapshot: { readonly level: number; readonly xp: number };
  readonly id: string;
  readonly lastHash: string;
  readonly seed: string;
  readonly startChainIndex: number;
}

interface OfflineOptimisticSource {
  readonly id: string;
  readonly settledXP: number;
  readonly tailPayload: unknown;
  readonly unverifiedDeltaSum: number;
}

/**
 * Maps a reconstructed attempt's tail onto the wire `CheckpointBatchEntry` shape, chaining each
 * entry's hash onto the row's own `lastHash` (or the previous entry's) exactly as
 * `buildCheckpointBatchEntry` chains a live submission. `appendedHead` offsets the first entry's
 * version for a row whose prefix is already confirmed — the reconstruction's own tail-slicing
 * point.
 */
function buildTailEntries(
  cursor: Readonly<OfflineRowCursor>,
  appendedHead: number,
  tail: ReadonlyArray<ActivityCheckpoint>,
  previousNextSeed: string | undefined,
): Array<CheckpointBatchEntry> {
  let prevHash = cursor.lastHash;
  let seed = previousNextSeed ?? cursor.seed;

  return tail.map((checkpoint, index) => {
    const entry = buildCheckpointBatchEntry({
      checkpoint,
      entropySource: ENTROPY_SOURCE_SERVER_KEY,
      prevHash,
      previousNextSeed: seed,
      startChainIndex: cursor.startChainIndex,
      version: appendedHead + index + 1,
    });

    prevHash = entry.hash;
    seed = entry.payload.nextSeed;

    return entry;
  });
}

function countLevelUps(checkpoints: ReadonlyArray<ActivityCheckpoint>): number {
  return checkpoints.filter(
    (checkpoint) =>
      checkpoint.type === ActivityCheckpointType.Progress && checkpoint.levelUp !== undefined,
  ).length;
}
