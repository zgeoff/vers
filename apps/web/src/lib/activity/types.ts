import type { ContractRouterClient } from '@orpc/contract';
import type { activityContract } from '@vers/contract-activity';
import type { DeepReadonly } from '../rpc/types';

export type RevealedRewardData = Awaited<
  ReturnType<ContractRouterClient<typeof activityContract>['getActivityRewards']>
>['items'][number];

export type RevealedReward = DeepReadonly<RevealedRewardData>;

export interface RevealedRewardsPage {
  readonly items: ReadonlyArray<RevealedReward>;
  readonly verifiedHead: number;
}
