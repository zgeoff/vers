import type { RevealedReward, RevealedRewardsPage } from './types';

/**
 * Accumulates a fresh keyset page of revealed rewards onto whatever the cache already holds,
 * deduping on `(chainIndex, ordinal)` — the coordinate a reward slot is identified by — so a
 * re-fetched overlap never double-counts. `verifiedHead` carries the higher of the two pages': the
 * fresher fetch's view of the settled boundary never regresses the cache's own.
 */
export function mergeRevealedRewards(
  previous: Readonly<RevealedRewardsPage> | undefined,
  page: Readonly<RevealedRewardsPage>,
): RevealedRewardsPage {
  const merged = new Map<string, RevealedReward>();

  for (const item of previous?.items ?? []) {
    merged.set(buildRewardKey(item), item);
  }

  for (const item of page.items) {
    merged.set(buildRewardKey(item), item);
  }

  return {
    items: [...merged.values()],
    verifiedHead: Math.max(previous?.verifiedHead ?? 0, page.verifiedHead),
  };
}

function buildRewardKey(item: Readonly<RevealedReward>): string {
  return `${item.chainIndex}:${item.ordinal}`;
}
