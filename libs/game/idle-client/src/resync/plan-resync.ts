import { OFFLINE_PROGRESS_CAP_MS } from '@vers/contract-activity';
import { PROGRESS_FLUSH_INTERVAL_MS } from '../submission/constants';
import type { ActivitySubmissionContext } from '../submission/types';
import type { LatestActivityProgress, ResyncPlan } from './types';

interface PlanResyncInput {
  readonly capMs?: number;
  readonly progress: LatestActivityProgress;
}

/**
 * Decides what a resync snapshot warrants before any simulation runs. The offline gap is computed
 * entirely from server data — the server clock minus the last append (or the start, for a stream
 * that never appended) — so a skewed local clock can neither inflate nor starve the budget, and
 * the budget never exceeds the cap. A capped activity resolves to a rebase from its exact stop
 * index rather than trusting any locally derived cursor. A non-active row plans nothing: pending
 * intents deliver before the snapshot is fetched, so whatever they mint is already in it.
 */
export function planResync(input: Readonly<PlanResyncInput>): ResyncPlan {
  const capMs = input.capMs ?? OFFLINE_PROGRESS_CAP_MS;
  const activity = input.progress.activity;

  const context: ActivitySubmissionContext = {
    activityID: activity.id,
    appendedHead: input.progress.appendedHead,
    lastHash: activity.lastHash,
    startChainIndex: activity.startChainIndex,
  };

  if (activity.status === 'capped') {
    return { context, kind: 'rebase' };
  }

  if (activity.status !== 'active') {
    return { kind: 'none' };
  }

  const anchorAt = activity.appendedAt ?? activity.startedAt;
  const gapMs = input.progress.serverTime.getTime() - anchorAt.getTime();
  const budgetMs = Math.min(gapMs, capMs);

  if (budgetMs < PROGRESS_FLUSH_INTERVAL_MS) {
    return { context, kind: 'attach-live' };
  }

  return { budgetMs, context, kind: 'fast-forward' };
}
