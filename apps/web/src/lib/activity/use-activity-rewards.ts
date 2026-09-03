import { useQuery, useQueryClient } from '@tanstack/react-query';
import invariant from 'tiny-invariant';
import { activityClient } from '../rpc/clients/activity-client';
import { mergeRevealedRewards } from './merge-revealed-rewards';
import type { RevealedRewardsPage } from './types';
import { useIsActivityIngested } from './use-is-activity-ingested';

const REFETCH_INTERVAL_MS = 15_000;

export function useActivityRewards(activityID: string | undefined) {
  const queryClient = useQueryClient();
  const isActivityIngested = useIsActivityIngested(activityID);
  const queryKey = ['activity', 'rewards', activityID] as const;

  return useQuery({
    enabled: activityID !== undefined && isActivityIngested,
    queryFn: async () => {
      invariant(activityID !== undefined, 'disabled while activityID is undefined');

      const previous = queryClient.getQueryData<RevealedRewardsPage>(queryKey);

      const lastSeenChainIndex = previous?.items.reduce(
        (max, item) => Math.max(max, item.chainIndex),
        0,
      );

      const page = await activityClient.getActivityRewards({
        activityID,
        ...(lastSeenChainIndex !== undefined && { afterChainIndex: lastSeenChainIndex }),
      });

      return mergeRevealedRewards(previous, page);
    },
    queryKey,
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
