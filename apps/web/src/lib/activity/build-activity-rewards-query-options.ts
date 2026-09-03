import type { OrpcQueryUtils } from '../rpc/orpc';

export function buildActivityRewardsQueryOptions(orpc: OrpcQueryUtils, activityID: string) {
  return orpc.activity.getActivityRewards.queryOptions({
    input: { activityID },
    refetchInterval: 10_000,
  });
}
