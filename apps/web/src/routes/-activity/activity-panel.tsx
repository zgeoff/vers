import { useQuery } from '@tanstack/react-query';
import { Spinner, Text } from '@vers/design-system';
import { EngagementView } from '@vers/idle-client';
import { css } from '@vers/styled-system/css';
import { ScreenLayout } from '../../components/screen-layout';
import { buildCurrentActivityQueryOptions } from '../../lib/activity/build-current-activity-query-options';
import { useActivityRewards } from '../../lib/activity/use-activity-rewards';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';

const catchingUpPanel = css({
  alignItems: 'center',
  backgroundColor: 'bg.panelElevated',
  display: 'flex',
  gap: '3',
  padding: '4',
});

/**
 * Shows an ambient notice while the activity's appended progress is ahead of its verified head —
 * the stretch whose rewards are not yet settled — above the live engagement view.
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
    <ScreenLayout title="Engagement">
      {pendingCount > 0 ? (
        <output className={catchingUpPanel} data-testid="catching-up-indicator">
          <span aria-hidden="true">
            <Spinner />
          </span>
          <Text>
            Catching up — {pendingCount} {pendingCount === 1 ? 'reward' : 'rewards'} settling
          </Text>
        </output>
      ) : null}
      <EngagementView />
    </ScreenLayout>
  );
}
