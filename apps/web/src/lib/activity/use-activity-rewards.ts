import { useQuery, useQueryClient } from '@tanstack/react-query';
import invariant from 'tiny-invariant';
import { activityClient } from '../rpc/clients/activity-client';
import { mergeRevealedRewards } from './merge-revealed-rewards';
import type { RevealedRewardsPage } from './types';
import { useIsActivityIngested } from './use-is-activity-ingested';

const REFETCH_INTERVAL_MS = 15_000;

/**
 * Polls an activity's revealed rewards, merging each fresh keyset page onto whatever the cache
 * already holds — no push channel names when a reward's verifying stream advances, so a short
 * poll is the honest minimal trigger. Disabled with no `activityID`, and until the worker has landed
 * the activity's start on the server — a run that exists only as a local mint has no rewards to
 * read there. Every returned item is
 * already settled; each item's `chainIndex` is chain-absolute while the page's `verifiedHead`
 * counts from the activity's own start, so comparing the two needs the activity row's
 * `startChainIndex` offset.
 */
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
