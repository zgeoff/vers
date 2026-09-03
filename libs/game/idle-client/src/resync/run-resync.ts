import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import type { ActivityInput, AvatarData, SimulationInputSource } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { readQueuedCheckpoints } from '../submission/read-queued-checkpoints';
import type { ActivityServiceClient } from '../submission/types';
import { planResync } from './plan-resync';
import { runFastForward } from './run-fast-forward';
import type { FastForwardProgress, LatestActivityProgress, ResyncResult } from './types';

interface RunResyncOptions {
  readonly avatarID: string;

  readonly buildSimulationInput: (
    source: Readonly<SimulationInputSource>,
  ) => Promise<{ activity: ActivityInput; avatar: AvatarData }>;

  readonly capMs?: number;

  readonly claimWriter?: boolean;

  readonly client: Pick<
    ActivityServiceClient,
    'advanceActivity' | 'getLatestActivityProgress' | 'resumeActivity'
  >;

  readonly isActivityLive?: (activityID: string) => boolean;

  readonly onProgress?: (progress: FastForwardProgress) => void;

  readonly onProgressFetched?: (progress: LatestActivityProgress) => Promise<void>;

  readonly onWriterLost?: (activityID: string) => void;

  readonly signal?: AbortSignal;

  readonly submitter: CheckpointSubmitter;
}

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
  let isLive = options.isActivityLive?.(first.activity.id) === true;

  // That reasoning holds only while this session is the run's writer. A live simulation of a run
  // another session took over is a dead fork: the caller stops it, and the pass proceeds as if
  // nothing were live — its queue drains (and is evicted server-side) like any stale fork's.
  if (isLive && first.activity.status === 'active' && !first.isWriter) {
    options.onWriterLost?.(first.activity.id);
    isLive = false;
  }

  const drained = isLive ? false : await drainQueuedCheckpoints(options.submitter, first);
  let progress = drained ? await readLatestProgress(options) : first;

  if (progress === null) {
    return { plan: { kind: 'none' }, progress: null };
  }

  // the claim runs only after the drain: a pre-claim drain would deliver a dead fork into the
  // claimed stream. A claim freezes the head against the displaced writer, but another session
  // can claim over this one, so the refetch adopts the refetched writer verdict
  let mayWrite = progress.isWriter;

  if (options.claimWriter === true && progress.activity.status === 'active' && !mayWrite) {
    const claimed = await claimActivityWriter(options.client, progress.activity.id);

    if (claimed === null) {
      // the row left `active` between the fetch and the claim — refetch and let the plan resolve
      // the terminal outcome
      progress = await readLatestProgress(options);

      mayWrite = progress?.isWriter ?? false;
    } else {
      mayWrite = true;

      if (claimed.appendedHead !== progress.appendedHead) {
        progress = await readLatestProgress(options);

        mayWrite = progress?.isWriter ?? false;
      }
    }

    if (progress === null) {
      return { plan: { kind: 'none' }, progress: null };
    }
  }

  await options.onProgressFetched?.(progress);

  const plan = planResync({
    mayWrite,
    progress,
    ...(options.capMs !== undefined && { capMs: options.capMs }),
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
    ...(options.onProgress !== undefined && { onProgress: options.onProgress }),
  });

  return { plan, progress, report };
}

async function readLatestProgress(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- carries a callback-bearing client handle, which has no readonly form
  options: Readonly<RunResyncOptions>,
): Promise<LatestActivityProgress | null> {
  const callOptions = options.signal === undefined ? undefined : { signal: options.signal };

  const [error, progress] = await safe(
    options.client.getLatestActivityProgress({ avatarID: options.avatarID }, callOptions),
  );

  if (error !== null) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') {
      return null;
    }

    throw error;
  }

  return progress;
}

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
    avatarID: progress.activity.avatarID,
    lastHash: progress.activity.lastHash,
    scopeID: progress.activity.scopeID,
    startChainIndex: progress.activity.startChainIndex,
  });

  const remaining = await readQueuedCheckpoints(progress.activity.id);

  if (remaining.length > 0) {
    throw new Error('queued checkpoints could not be delivered before planning a resync');
  }

  return true;
}

async function claimActivityWriter(
  client: Pick<ActivityServiceClient, 'resumeActivity'>,
  activityID: string,
): Promise<ActivityData | null> {
  const [error, activity] = await safe(client.resumeActivity({ activityID }));

  if (error !== null) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') {
      return null;
    }

    throw error;
  }

  return activity;
}
