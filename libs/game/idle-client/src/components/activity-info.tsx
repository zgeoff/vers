import { Heading, Text } from '@vers/design-system';
import type { ActivitySnapshot } from '@vers/idle-core';
import { css } from '@vers/styled-system/css';

const activityInfo = css({
  flex: '1',
  padding: '2',
});

interface ActivityInfoProps {
  activity: ActivitySnapshot;
}

export function ActivityInfo(props: Readonly<ActivityInfoProps>) {
  return (
    <section className={activityInfo}>
      <Heading level={2}>{props.activity.name}</Heading>
      <Text>
        <strong>{props.activity.wavesRemaining}</strong> waves remain
      </Text>
      <Text>
        <strong>{props.activity.enemiesRemaining}</strong> enemies remain
      </Text>
      <Text>
        <strong>{props.activity.rewards.xp}</strong> xp earned
      </Text>
    </section>
  );
}
