import type { ContractRouterClient } from '@orpc/contract';
import type { activityContract } from '@vers/contract-activity';

/**
 * One revealed reward slot, as `getActivityRewards` returns it.
 */
export type RevealedReward = Awaited<
  ReturnType<ContractRouterClient<typeof activityContract>['getActivityRewards']>
>['items'][number];

/**
 * A page of revealed rewards, keyed by the verified head it was read against.
 */
export interface RevealedRewardsPage {
  readonly items: ReadonlyArray<RevealedReward>;
  readonly verifiedHead: number;
}
