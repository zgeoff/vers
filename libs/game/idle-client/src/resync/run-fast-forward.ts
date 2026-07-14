import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import type { ActivityCheckpoint, ActivityInput, AvatarData } from '@vers/idle-core';
import { ActivityCheckpointType, ActivityFailureAction, runAttempt } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import type { FastForwardProgress, FastForwardReport, LatestActivityProgress } from './types';

interface RunFastForwardOptions {
  readonly avatar: AvatarData;
  readonly budgetMs: number;

  /**
   * Maps a server-authored activity row onto the engine's simulation input; the caller owns
   * content derivation.
   */
  readonly buildActivityInput: (activity: ActivityData) => ActivityInput;
  readonly client: Pick<ActivityServiceClient, 'startActivity'>;
  readonly onProgress?: (progress: FastForwardProgress) => void;
  readonly progress: LatestActivityProgress;
  readonly submitter: CheckpointSubmitter;
}

/**
 * Simulates an offline gap attempt by attempt: reconstruction of the snapshot's active activity
 * from its seed first, then fresh continuations started server-side, submitting each committed
 * attempt's stream as it lands. Budget accounting mirrors the server's meter — each attempt
 * consumes its last checkpoint's cumulative time beyond what the head row already accounted, so a
 * reconstructed prefix costs nothing — and an attempt whose unaccounted time overruns the
 * remaining budget is discarded, never submitted, keeping every submitted stream inside the cap
 * and boundary-terminated. Failure policy is the activity's own, identical to live play: a failed
 * attempt under `Retry` continues to the next continuation, under `Abort` it ends the
 * fast-forward.
 */
export async function runFastForward(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- carries the zod-inferred contract progress shape and a callback-bearing submitter handle, neither of which has a readonly form
  options: Readonly<RunFastForwardOptions>,
): Promise<FastForwardReport> {
  let remainingMs = options.budgetMs;
  let attempts = 0;
  let levelUps = 0;
  let activity = options.progress.activity;
  let appendedHead = options.progress.appendedHead;

  while (remainingMs > 0) {
    const input = options.buildActivityInput(activity);

    // A reconstruction must reach its terminal to reconcile, whatever the budget — its prefix is
    // already accounted server-side, so only the tail is priced against the budget below.
    const ceilingMs = appendedHead > 0 ? Number.MAX_SAFE_INTEGER : remainingMs;

    const attempt = await runAttempt(input, options.avatar, { maxDurationMs: ceilingMs });

    if (attempt.outcome === 'exceeded-budget') {
      return { attempts, levelUps, reason: 'budget-exhausted' };
    }

    const lastCheckpoint = attempt.checkpoints.at(-1);
    const lastAppended = appendedHead > 0 ? attempt.checkpoints[appendedHead - 1] : undefined;
    const tailTimeMs = (lastCheckpoint?.time ?? 0) - (lastAppended?.time ?? 0);

    if (tailTimeMs > remainingMs) {
      return { attempts, levelUps, reason: 'budget-exhausted' };
    }

    const tail = attempt.checkpoints.slice(appendedHead);

    await options.submitter.attach({
      activityID: activity.id,
      appendedHead,
      lastHash: activity.lastHash,
      startChainIndex: activity.startChainIndex,
      ...(lastAppended !== undefined && { previousNextSeed: lastAppended.nextSeed }),
    });

    for (const checkpoint of tail) {
      await options.submitter.submit(activity.id, checkpoint);
    }

    attempts += 1;
    levelUps += countLevelUps(tail);
    remainingMs -= tailTimeMs;
    options.onProgress?.({ attempts, levelUps });

    if (attempt.outcome === 'failed' && input.failureAction === ActivityFailureAction.Abort) {
      return { attempts, levelUps, reason: 'aborted-on-failure' };
    }

    if (remainingMs <= 0) {
      break;
    }

    const [error, started] = await safe(
      options.client.startActivity({
        avatarID: activity.avatarID,
        scopeID: activity.scopeID,
        scopeType: activity.scopeType,
      }),
    );

    if (error !== null) {
      if (isDefinedError(error) && error.code === 'CONFLICT') {
        activity = error.data.activity;
        appendedHead = error.data.activity.appendedHead;
        continue;
      }

      throw error;
    }

    activity = started;
    appendedHead = 0;
  }

  return { attempts, levelUps, reason: 'budget-exhausted' };
}

function countLevelUps(checkpoints: ReadonlyArray<ActivityCheckpoint>): number {
  return checkpoints.filter(
    (checkpoint) =>
      checkpoint.type === ActivityCheckpointType.Progress && checkpoint.levelUp !== undefined,
  ).length;
}
