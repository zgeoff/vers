import { useQuery } from '@tanstack/react-query';
import { Heading, Spinner, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { currentActivityQueryOptions } from '../../lib/activity/current-activity-query-options';
import { useActivityRewards } from '../../lib/activity/use-activity-rewards';
import { activeAvatarQueryOptions } from '../../lib/avatar/active-avatar-query-options';

const CHARACTER_FRAMES: ReadonlyArray<string> = ['Vanguard', 'Support', 'Striker'];

const panel = css({
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderWidth: '[1px]',
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  margin: '6',
  padding: '6',
});

const catchingUpPanel = css({
  alignItems: 'center',
  backgroundColor: 'bg.panelElevated',
  display: 'flex',
  gap: '3',
  padding: '4',
});

const characterFrameRow = css({
  display: 'flex',
  gap: '3',
});

const characterFrame = css({
  backgroundColor: 'bg.panelElevated',
  flex: '1',
  padding: '3',
  textAlign: 'center',
});

/**
 * The activity screen: an ambient notice while any revealed reward is still short of the verified
 * head, and placeholder character-frame blocks until party state is wired up. Reward items
 * themselves — batches, per-item cards — are a different screen's concern.
 */
export function ActivityPanel() {
  const avatarQuery = useQuery(activeAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;

  const currentActivityQuery = useQuery({
    ...currentActivityQueryOptions(avatarID ?? ''),
    enabled: avatarID !== undefined,
  });

  const activityID = currentActivityQuery.data?.id;
  const rewardsQuery = useActivityRewards(activityID);
  const verifiedHead = rewardsQuery.data?.verifiedHead ?? 0;

  const pendingCount =
    rewardsQuery.data?.items.filter((item) => item.chainIndex > verifiedHead).length ?? 0;

  return (
    <main className={panel}>
      <Heading level={1}>Activity</Heading>
      {pendingCount > 0 && (
        <div className={catchingUpPanel} data-testid="catching-up-indicator">
          <Spinner />
          <Text>Catching up — {pendingCount} rewards settling</Text>
        </div>
      )}
      <div className={characterFrameRow}>
        {CHARACTER_FRAMES.map((label) => (
          <div key={label} className={characterFrame} data-testid="character-frame">
            <Text>{label}</Text>
          </div>
        ))}
      </div>
    </main>
  );
}
