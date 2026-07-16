import { Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';

export function ActivityProgressNotice() {
  const idleWorkerHandle = useIdleWorkerHandle();
  const activity = idleWorkerHandle.activity;

  if (activity === undefined) {
    return null;
  }

  const wavesCleared = activity.waves.length - activity.wavesRemaining;

  return (
    <output className={notice} data-testid="activity-progress-notice">
      <Text>{activity.name}</Text>
      <Text>
        {wavesCleared} of {activity.waves.length} waves cleared
      </Text>
      <Text>+{activity.rewards.xp} XP</Text>
    </output>
  );
}

const notice = css({
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderWidth: '[1px]',
  display: 'flex',
  gap: '3',
  padding: '3',
});
