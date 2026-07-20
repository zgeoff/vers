import type { ActivityData } from '@vers/contract-activity';
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

/**
 * `activity`/`appendedHead` are the final row and confirmed head the fast-forward left off at —
 * whichever continuation was live when the budget ran out or a failure aborted it — so a caller
 * can attach to it directly without a further round trip. `finalRowTerminal` is true when the
 * fast-forward itself submitted that row's terminal checkpoint: the stream is closed even though
 * the row's fetched `status` still reads active, so no live attach may follow.
 */
export interface FastForwardReport extends FastForwardProgress {
  readonly activity: ActivityData;
  readonly appendedHead: number;
  readonly finalRowTerminal: boolean;
  readonly reason: 'aborted-on-failure' | 'budget-exhausted';
}

/**
 * `progress` is the confirmed snapshot the plan was decided from — `null` only when the avatar has
 * no activity history at all, the one case nothing was ever fetched to report. A fast-forward plan
 * always carries the report its run produced; no other plan kind has one, so a completed
 * fast-forward can never be represented without its recovery data.
 */
export type ResyncResult =
  | {
      readonly plan: Exclude<ResyncPlan, { kind: 'fast-forward' }>;
      readonly progress: LatestActivityProgress | null;
      readonly report?: undefined;
    }
  | {
      readonly plan: Extract<ResyncPlan, { kind: 'fast-forward' }>;
      readonly progress: LatestActivityProgress;
      readonly report: FastForwardReport;
    };
