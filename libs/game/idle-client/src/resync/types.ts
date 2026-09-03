import type { ActivityData } from '@vers/contract-activity';
import type { ActivityServiceClient, ActivitySubmissionContext } from '../submission/types';

export type LatestActivityProgress = Awaited<
  ReturnType<ActivityServiceClient['getLatestActivityProgress']>
>;

export type ResyncPlan =
  | {
      readonly budgetMs: number;
      readonly context: ActivitySubmissionContext;
      readonly kind: 'fast-forward';
    }
  | { readonly activityID: string; readonly kind: 'active-elsewhere' }
  | { readonly context: ActivitySubmissionContext; readonly kind: 'attach-live' }
  | { readonly context: ActivitySubmissionContext; readonly kind: 'rebase' }
  | { readonly kind: 'none' };

export interface FastForwardProgress {
  readonly attempts: number;
  readonly levelUps: number;
}

export type FastForwardReport = FastForwardProgress & {
  readonly activity: ActivityData;
  readonly appendedHead: number;
  readonly finalRowTerminal: boolean;
} & (
    | { readonly activeAvatarName: string; readonly reason: 'avatar-switched' }
    | { readonly reason: 'aborted-on-failure' | 'budget-exhausted' | 'displaced' }
  );

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
