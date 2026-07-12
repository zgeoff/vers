import { Heading, Text } from '@vers/design-system';
import type { ActivityAppState } from '@vers/idle-core';
import { css } from '@vers/styled-system/css';

const activityInfo = css({
  flex: '1',
  padding: '2',
});

interface ActivityInfoProps {
  activity: ActivityAppState;
}

export function ActivityInfo(props: Readonly<ActivityInfoProps>) {
  return (
    <section className={activityInfo}>
      <Heading level={2}>{props.activity.name}</Heading>
      <Text>
        <strong>{props.activity.enemyGroupsRemaining}</strong> enemy groups remain
      </Text>
      <Text>
        <strong>{props.activity.enemiesRemaining}</strong> enemies remain
      </Text>
      <Text>
        <strong>{props.activity.rewards.xp}</strong> xp earned
      </Text>
      {props.activity.levelUp && (
        <Text>
          Leveled up to <strong>{props.activity.levelUp.to}</strong>!
        </Text>
      )}
    </section>
  );
}
