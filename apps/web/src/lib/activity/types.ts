import type { ContractRouterClient } from '@orpc/contract';
import type { activityContract } from '@vers/contract-activity';
import type { DeepReadonly } from '../rpc/types';

/**
 * One revealed reward slot's wire shape, as `getActivityRewards` returns it — mutable, the form
 * mock handlers and payload builders produce.
 */
export type RevealedRewardData = Awaited<
  ReturnType<ContractRouterClient<typeof activityContract>['getActivityRewards']>
>['items'][number];

/**
 * One revealed reward slot as consumers read it: the wire shape, deep-readonly.
 */
export type RevealedReward = DeepReadonly<RevealedRewardData>;

/**
 * A page of revealed rewards, keyed by the verified head it was read against.
 */
export interface RevealedRewardsPage {
  readonly items: ReadonlyArray<RevealedReward>;
  readonly verifiedHead: number;
}
