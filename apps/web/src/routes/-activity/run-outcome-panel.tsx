import { Button, Heading, Text } from '@vers/design-system';
import type { RunOutcome } from '@vers/idle-client';
import { ActivityCheckpointType } from '@vers/idle-core';
import { css } from '@vers/styled-system/css';
import { useActivityRewards } from '../../lib/activity/use-activity-rewards';

const panel = css({
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderRadius: '[13px]',
  borderWidth: '[1px]',
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  maxWidth: '[640px]',
  padding: '4',
});

const rewardList = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
});

const rewardItem = css({
  backgroundColor: 'bg.panelElevated',
  padding: '2',
});

const actions = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '3',
});

interface RunOutcomePanelProps {
  readonly isRetryPending?: boolean;
  readonly onBackToMap: () => void;
  readonly onRetry?: () => void;
  readonly outcome: RunOutcome;
}

export function RunOutcomePanel(props: Readonly<RunOutcomePanelProps>) {
  const rewardsQuery = useActivityRewards(props.outcome.activityID);
  const items = rewardsQuery.data?.items ?? [];
  const isCleared = props.outcome.kind === ActivityCheckpointType.Completed;

  return (
    <section className={panel} data-testid="run-outcome-panel">
      <Heading level={2}>{isCleared ? 'Encounter cleared' : 'Your avatar fell'}</Heading>
      <Text>
        {isCleared
          ? 'Every wave is down and the node is clear.'
          : 'The run ended before the node was clear.'}
      </Text>
      <Text bold>+{props.outcome.xp} XP</Text>
      <Heading level={3}>Rewards</Heading>
      {items.length === 0 ? (
        <Text>No rewards revealed yet.</Text>
      ) : (
        <ul className={rewardList}>
          {items.map((item) => (
            <li className={rewardItem} key={`${item.chainIndex}-${item.ordinal}`}>
              <Text>
                {item.item.rarityID} {item.item.baseID}
              </Text>
            </li>
          ))}
        </ul>
      )}
      <div className={actions}>
        {props.onRetry === undefined ? null : (
          <Button disabled={props.isRetryPending === true} onClick={props.onRetry} type="button">
            Retry
          </Button>
        )}
        <Button onClick={props.onBackToMap} type="button" variant="secondary">
          Back to map
        </Button>
      </div>
    </section>
  );
}
