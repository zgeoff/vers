import { useQuery } from '@tanstack/react-query';
import { Spinner, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { ScreenLayout } from '../../components/screen-layout';
import { ScreenPanel } from '../../components/screen-panel';
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

const plateRow = css({ display: 'grid', gap: '3', gridTemplateColumns: 'repeat(5, 1fr)' });

const plate = css({
  borderColor: 'border',
  borderRadius: 'md',
  borderWidth: '[1px]',
  minHeight: '[6rem]',
});

const twoColumns = css({ display: 'grid', gap: '4', gridTemplateColumns: 'repeat(2, 1fr)' });

/**
 * Shows an ambient notice while the activity's appended progress is ahead of its verified head —
 * the stretch whose rewards are not yet settled.
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
      <ScreenPanel label="Mission — depth · auto · end run" />
      <ScreenPanel label="Encounter — up to 5 enemy plates">
        <div className={plateRow}>
          {['plate-1', 'plate-2', 'plate-3', 'plate-4', 'plate-5'].map((key) => (
            <span key={key} className={plate} data-testid="enemy-plate" />
          ))}
        </div>
      </ScreenPanel>
      <div className={twoColumns}>
        <ScreenPanel label="Avatar — life / barrier / aether · abilities" />
        <ScreenPanel label="Loot — rewards to collect" />
      </div>
    </ScreenLayout>
  );
}
