import { Button, Heading, Text } from '@vers/design-system';
import type { RunOutcome } from '@vers/idle-client';
import { RunOutcomeKind } from '@vers/idle-client';
import { css } from '@vers/styled-system/css';
import type { RevealedRewardsPage } from '../../lib/activity/types';
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
  const isRefused = props.outcome.kind === RunOutcomeKind.Refused;
  const isCleared = props.outcome.kind === RunOutcomeKind.Completed;

  // a refused run has no server row, so there are no rewards to read for it
  const rewardsActivityID = isRefused ? undefined : props.outcome.activityID;
  const rewardsQuery = useActivityRewards(rewardsActivityID);

  if (isRefused) {
    return (
      <section className={panel} data-testid="run-outcome-panel">
        <Heading level={2}>Run could not be saved</Heading>
        <Text>
          The server refused this run’s starting state, so its progress was not kept. Start again
          from the map.
        </Text>
        {renderActions(props)}
      </section>
    );
  }

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
      {renderRewards({
        isError: rewardsQuery.isError,
        isPending: rewardsQuery.isPending,
        items: rewardsQuery.data?.items ?? [],
      })}
      {renderActions(props)}
    </section>
  );
}

function renderActions(props: Readonly<RunOutcomePanelProps>) {
  return (
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
  );
}

interface RewardsState {
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly items: RevealedRewardsPage['items'];
}

function renderRewards(state: Readonly<RewardsState>) {
  if (state.isPending) {
    return <Text>Reading rewards…</Text>;
  }

  if (state.isError) {
    return <Text>Rewards could not be loaded.</Text>;
  }

  if (state.items.length === 0) {
    return <Text>No rewards revealed yet.</Text>;
  }

  return (
    <ul className={rewardList}>
      {state.items.map((item) => (
        <li className={rewardItem} key={`${item.chainIndex}-${item.ordinal}`}>
          <Text>
            {item.item.rarityID} {item.item.baseID}
          </Text>
          {item.item.affixes.map((affix) => (
            <Text key={`${affix.affixID}-${affix.groupID}`}>
              {affix.affixID} +{affix.value}
            </Text>
          ))}
        </li>
      ))}
    </ul>
  );
}
