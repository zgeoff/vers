import { useQuery } from '@tanstack/react-query';
import { Heading, Spinner, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { buildCurrentActivityQueryOptions } from '../../lib/activity/build-current-activity-query-options';
import { useActivityRewards } from '../../lib/activity/use-activity-rewards';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';

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
 * The activity screen: an ambient notice while the activity's appended progress is still ahead of
 * its verified head — the stretch whose rewards are not yet settled — and placeholder
 * character-frame blocks standing in for party state. Reward items themselves — batches,
 * per-item cards — are a different screen's concern.
 */
export function ActivityPanel() {
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;

  const currentActivityQuery = useQuery({
    ...buildCurrentActivityQueryOptions(avatarID ?? ''),
    enabled: avatarID !== undefined,
  });

  const activity = currentActivityQuery.data;
  const rewardsQuery = useActivityRewards(activity?.id);

  // both heads count from the activity's own start; the rewards poll advances the verified head
  // between refetches of the activity row itself
  const verifiedHead = Math.max(activity?.verifiedHead ?? 0, rewardsQuery.data?.verifiedHead ?? 0);

  const pendingCount =
    activity === null || activity === undefined
      ? 0
      : Math.max(0, activity.appendedHead - verifiedHead);

  return (
    <main className={panel}>
      <Heading level={1}>Activity</Heading>
      {pendingCount > 0 && (
        <output className={catchingUpPanel} data-testid="catching-up-indicator">
          <span aria-hidden="true">
            <Spinner />
          </span>
          <Text>
            Catching up — {pendingCount} {pendingCount === 1 ? 'reward' : 'rewards'} settling
          </Text>
        </output>
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
