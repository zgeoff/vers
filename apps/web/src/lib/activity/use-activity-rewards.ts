import { useQuery, useQueryClient } from '@tanstack/react-query';
import invariant from 'tiny-invariant';
import { activityClient } from '../rpc/clients/activity-client';
import { mergeRevealedRewards } from './merge-revealed-rewards';
import type { RevealedRewardsPage } from './types';

const REFETCH_INTERVAL_MS = 15_000;

/**
 * Polls an activity's revealed rewards, merging each fresh keyset page onto whatever the cache
 * already holds — no push channel names when a reward's verifying stream advances, so a short
 * poll is the honest minimal trigger. Disabled with no `activityID`. `item.chainIndex <=
 * data.verifiedHead` is a caller's own test for whether a merged item is final or still pending.
 */
export function useActivityRewards(activityID: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['activity', 'rewards', activityID] as const;

  return useQuery({
    enabled: activityID !== undefined,
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
