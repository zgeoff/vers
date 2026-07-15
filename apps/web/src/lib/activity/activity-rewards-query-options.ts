import type { OrpcQueryUtils } from '../rpc/orpc';

/**
 * Query options for an activity's revealed reward-slot contents: refetched on a modest interval
 * while the panel keeps it mounted, so newly verified rewards surface without a manual refresh.
 */
export function activityRewardsQueryOptions(orpc: OrpcQueryUtils, activityID: string) {
  return orpc.activity.getActivityRewards.queryOptions({
    input: { activityID },
    refetchInterval: 10_000,
  });
}
