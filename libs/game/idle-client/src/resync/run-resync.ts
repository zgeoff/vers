import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import type { ActivityInput, AvatarData } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { readQueuedCheckpoints } from '../submission/read-queued-checkpoints';
import type { ActivityServiceClient } from '../submission/types';
import type { PendingContinuation } from '../worker/types';
import { planResync } from './plan-resync';
import { runFastForward } from './run-fast-forward';
import type { FastForwardProgress, LatestActivityProgress, ResyncResult } from './types';

interface RunResyncOptions {
  readonly avatarID: string;

  /**
   * Derives the engine's simulation input and avatar from a server-authored activity row, called
   * fresh for every continuation a fast-forward runs through.
   */
  readonly buildSimulationInput: (activity: ActivityData) => {
    activity: ActivityInput;
    avatar: AvatarData;
  };

  readonly capMs?: number;
  readonly client: Pick<ActivityServiceClient, 'getLatestActivityProgress' | 'startActivity'>;

  /**
   * Reports whether a live simulation is already running the given activity. When it is, a
   * fast-forward plan is downgraded to `attach-live`: the ticking simulation is the stream's
   * writer, and re-simulating the gap under it would submit duplicate checkpoints.
   */
  readonly isActivityLive?: (activityID: string) => boolean;

  /**
   * Reports fast-forward tallies as they land, starting with a zero-tally report the moment a
   * fast-forward plan is committed — before any checkpoint work — so a caller masking the
   * catch-up can open its cover for the whole run, not just from the first landed batch. Plans
   * that run no fast-forward (live re-attach, rebase, none) never report through this callback.
   */
  readonly onProgress?: (progress: FastForwardProgress) => void;

  /**
   * Runs once the confirmed snapshot is settled, before any plan is decided — the resync's one
   * chance to reconcile the failure-action preference against the fetched progress before a
   * fast-forward reads it.
   */
  readonly onProgressFetched?: (progress: LatestActivityProgress) => Promise<void>;

  /**
   * A continuation a previous worker started but couldn't complete, honored as a `continue` plan
   * once its target row reads closed.
   */
  readonly pendingContinuation?: PendingContinuation | null;

  readonly submitter: CheckpointSubmitter;
}

/**
 * Refetches the avatar's confirmed activity state and dispatches on what it warrants: a
 * fast-forward over the offline gap, a live re-attach, a rebase from a capped stop index, or
 * nothing. The confirmed head and server time are read before any long optimistic re-simulation
 * commits, so a stale local view never produces a large optimistic rollback. An avatar with no
 * activity history resolves to `none`. Checkpoints the durable queue still holds for the fetched
 * activity — rows a previous worker queued but never delivered — are drained first and the
 * snapshot refetched, so the plan and any reconstruction target the head those rows advanced;
 * planning past them would re-emit their content at shifted versions and corrupt the stream. A
 * live activity is never drained: its queue is the running writer's own pipeline. An
 * `attach-live` plan never registers the submitter itself — under the submitter's
 * single-registration semantics, a premature empty-cursor registration is permanent, so the
 * caller registers only once it has reconstructed the live simulation the cursor belongs to.
 */
export async function runResync(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- carries a callback-bearing submitter handle and client, neither of which has a readonly form
  options: Readonly<RunResyncOptions>,
): Promise<ResyncResult> {
  const first = await readLatestProgress(options);

  if (first === null) {
    return { plan: { kind: 'none' }, progress: null };
  }

  // A live activity's queued rows are its writer's normal in-flight pipeline, not stranded
  // work — draining would re-register as a no-op, find the rows still queued, and falsely
  // report a healthy session offline.
  const isLive = options.isActivityLive?.(first.activity.id) === true;
  const drained = isLive ? false : await drainQueuedCheckpoints(options.submitter, first);
  const progress = drained ? await readLatestProgress(options) : first;

  if (progress === null) {
    return { plan: { kind: 'none' }, progress: null };
  }

  await options.onProgressFetched?.(progress);

  const plan = planResync({
    progress,
    ...(options.capMs !== undefined && { capMs: options.capMs }),
    ...(options.pendingContinuation !== undefined && {
      pendingContinuation: options.pendingContinuation,
    }),
  });

  if (plan.kind !== 'fast-forward') {
    return { plan, progress };
  }

  if (isLive) {
    return { plan: { context: plan.context, kind: 'attach-live' }, progress };
  }

  options.onProgress?.({ attempts: 0, levelUps: 0 });

  const report = await runFastForward({
    budgetMs: plan.budgetMs,
    buildSimulationInput: options.buildSimulationInput,
    client: options.client,
    progress,
    submitter: options.submitter,
    ...(options.onProgress !== undefined && { onProgress: options.onProgress }),
  });

  return { plan, progress, report };
}

async function readLatestProgress(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- carries a callback-bearing client handle, which has no readonly form
  options: Readonly<RunResyncOptions>,
): Promise<LatestActivityProgress | null> {
  const [error, progress] = await safe(
    options.client.getLatestActivityProgress({ avatarID: options.avatarID }),
  );

  if (error !== null) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') {
      return null;
    }

    throw error;
  }

  return progress;
}

/**
 * Delivers whatever the durable queue still holds for the fetched activity, returning whether
 * anything was pending. Registration seeds the submitter's cursor from the queued rows themselves
 * — the one source that survives a worker restart — and its flush submits them. Rows that remain
 * after the flush mean delivery failed (held for retry), and planning would proceed against a
 * head the queue is still ahead of, so that is an error rather than a silent misalignment.
 */
async function drainQueuedCheckpoints(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a callback-bearing submitter handle, which has no readonly form
  submitter: CheckpointSubmitter,
  progress: Readonly<LatestActivityProgress>,
): Promise<boolean> {
  const pending = await readQueuedCheckpoints(progress.activity.id);

  if (pending.length === 0) {
    return false;
  }

  await submitter.registerActivity({
    activityID: progress.activity.id,
    appendedHead: progress.appendedHead,
    lastHash: progress.activity.lastHash,
    startChainIndex: progress.activity.startChainIndex,
  });

  const remaining = await readQueuedCheckpoints(progress.activity.id);

  if (remaining.length > 0) {
    throw new Error('queued checkpoints could not be delivered before planning a resync');
  }

  return true;
}
