import { useQuery } from '@tanstack/react-query';
import { Heading, Text } from '@vers/design-system';
import { useRewardSlotLedger } from '@vers/idle-client';
import type { RewardSlotLedgerEntry } from '@vers/idle-client';
import { css } from '@vers/styled-system/css';
import { activityRewardsQueryOptions } from '../../lib/activity/activity-rewards-query-options';
import type { OrpcQueryUtils } from '../../lib/rpc/orpc';

interface ActivityRewardsPanelProps {
  readonly activityID: string | undefined;
  readonly orpc: OrpcQueryUtils;
}

const panelStyles = css({
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderWidth: '[1px]',
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  padding: '4',
});

const listStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
});

const itemStyles = css({
  backgroundColor: 'bg.panelElevated',
  padding: '2',
});

/**
 * Shows an activity's settled reward items and, while checkpoints the server hasn't yet verified
 * are still in flight, one ambient line reporting how many rewards are pending — never a per-item
 * placeholder. Renders nothing without an active activity. The reveal itself is already gated
 * server-side on the verified anchor, so every item this panel receives is settled — it applies no
 * chain-index filtering of its own.
 */
export function ActivityRewardsPanel(props: ActivityRewardsPanelProps) {
  const rewardSlotLedger = useRewardSlotLedger();

  const query = useQuery({
    ...activityRewardsQueryOptions(props.orpc, props.activityID ?? ''),
    enabled: props.activityID !== undefined,
  });

  if (props.activityID === undefined || query.data === undefined) {
    return null;
  }

  const pendingCount = countPendingRewardSlots(rewardSlotLedger, query.data.verifiedHead);

  return (
    <section className={panelStyles} data-testid="activity-rewards-panel">
      <Heading level={3}>Rewards</Heading>
      {pendingCount > 0 && (
        <Text data-testid="activity-rewards-pending">
          {formatPendingRewardsStatus(pendingCount)}
        </Text>
      )}
      <ul className={listStyles}>
        {query.data.items.map((item) => (
          <li className={itemStyles} key={`${item.chainIndex}-${item.ordinal}`}>
            <Text>
              {item.item.rarityID} {item.item.baseID}
            </Text>
            {item.item.affixes.map((affix) => (
              <Text key={affix.affixID}>
                {affix.affixID} +{affix.value}
              </Text>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function countPendingRewardSlots(
  ledger: ReadonlyArray<RewardSlotLedgerEntry>,
  verifiedHead: number,
): number {
  return ledger
    .filter((entry) => entry.version > verifiedHead)
    .reduce((total, entry) => total + entry.count, 0);
}

function formatPendingRewardsStatus(pendingCount: number): string {
  const noun = pendingCount === 1 ? 'reward' : 'rewards';

  return `Catching up… ${pendingCount} ${noun} pending.`;
}
