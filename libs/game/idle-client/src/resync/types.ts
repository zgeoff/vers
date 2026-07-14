import type { ActivityServiceClient, ActivitySubmissionContext } from '../submission/types';

export type LatestActivityProgress = Awaited<
  ReturnType<ActivityServiceClient['getLatestActivityProgress']>
>;

/**
 * The action a resync snapshot resolves to, decided before any simulation runs: `fast-forward`
 * re-simulates the offline gap up to its budget, `attach-live` resumes live submission with no
 * catch-up worth simulating, `rebase` restarts bookkeeping from a capped activity's stop index,
 * and `none` means no resumable activity exists.
 */
export type ResyncPlan =
  | {
      readonly budgetMs: number;
      readonly context: ActivitySubmissionContext;
      readonly kind: 'fast-forward';
    }
  | { readonly context: ActivitySubmissionContext; readonly kind: 'attach-live' }
  | { readonly context: ActivitySubmissionContext; readonly kind: 'rebase' }
  | { readonly kind: 'none' };

export interface FastForwardProgress {
  readonly attempts: number;
  readonly levelUps: number;
}

export interface FastForwardReport extends FastForwardProgress {
  readonly reason: 'aborted-on-failure' | 'budget-exhausted';
}

export interface ResyncResult {
  readonly plan: ResyncPlan;
  readonly report?: FastForwardReport;
}
