import { OFFLINE_PROGRESS_CAP_MS } from '@vers/contract-activity';
import { PROGRESS_FLUSH_INTERVAL_MS } from '../submission/constants';
import type { ActivitySubmissionContext } from '../submission/types';
import type { LatestActivityProgress, ResyncPlan } from './types';

interface PlanResyncInput {
  readonly capMs?: number;

  readonly mayWrite: boolean;

  readonly progress: LatestActivityProgress;
}

export function planResync(input: Readonly<PlanResyncInput>): ResyncPlan {
  const capMs = input.capMs ?? OFFLINE_PROGRESS_CAP_MS;
  const activity = input.progress.activity;

  const context: ActivitySubmissionContext = {
    activityID: activity.id,
    appendedHead: input.progress.appendedHead,
    avatarID: activity.avatarID,
    lastHash: activity.lastHash,
    scopeID: activity.scopeID,
    startChainIndex: activity.startChainIndex,
  };

  if (activity.status === 'capped') {
    return { context, kind: 'rebase' };
  }

  if (activity.status !== 'active') {
    return { kind: 'none' };
  }

  if (!input.mayWrite) {
    return { activityID: activity.id, kind: 'active-elsewhere' };
  }

  const anchorAt = activity.appendedAt ?? activity.startedAt;
  const gapMs = input.progress.serverTime.getTime() - anchorAt.getTime();
  const budgetMs = Math.min(gapMs, capMs);

  if (budgetMs < PROGRESS_FLUSH_INTERVAL_MS) {
    return { context, kind: 'attach-live' };
  }

  return { budgetMs, context, kind: 'fast-forward' };
}
