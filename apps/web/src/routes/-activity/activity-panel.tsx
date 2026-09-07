import { safe } from '@orpc/client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Spinner } from '@vers/design-system';
import { EngagementView } from '@vers/idle-client';
import { css } from '@vers/styled-system/css';
import { useEffect } from 'react';
import { ScreenLayout } from '../../components/screen-layout';
import { buildCurrentActivityQueryOptions } from '../../lib/activity/build-current-activity-query-options';
import { useActivityRewards } from '../../lib/activity/use-activity-rewards';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { runIgnoringRejection } from '../../lib/idle/run-ignoring-rejection';
import { sendIdleStopActivity } from '../../lib/idle/send-idle-stop-activity';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { activityClient } from '../../lib/rpc/clients/activity-client';

const settlingIndicator = css({
  bottom: '4',
  position: 'fixed',
  right: '4',
  zIndex: '[50]',
});

export function ActivityPanel() {
  const navigate = useNavigate();
  const idleWorkerHandle = useIdleWorkerHandle();
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;
  const avatarName = avatarQuery.data?.name;

  const currentActivityQuery = useQuery({
    ...buildCurrentActivityQueryOptions(avatarID ?? ''),
    enabled: avatarID !== undefined,
  });

  const activity = currentActivityQuery.data;
  const liveActivity = idleWorkerHandle.activity;
  const rewardsQuery = useActivityRewards(activity?.id);

  // the worker is the source of the live run: a client-authored start reaches the server only on
  // the first checkpoint flush, so the server row stands in only for a cold load the worker has
  // not attached yet, and the map is the destination only when neither holds a run
  const hasNoRun = idleWorkerHandle.initialized && liveActivity === undefined && activity === null;

  useEffect(() => {
    if (hasNoRun) {
      void navigate({ to: '/explore' });
    }
  }, [hasNoRun, navigate]);

  // both heads count from the activity's own start; the rewards poll advances the verified head
  // between refetches of the activity row itself
  const verifiedHead = Math.max(activity?.verifiedHead ?? 0, rewardsQuery.data?.verifiedHead ?? 0);

  const pendingCount =
    activity === null || activity === undefined
      ? 0
      : Math.max(0, activity.appendedHead - verifiedHead);

  // the worker owns the stop end to end, so navigation never waits on the network. With no
  // transport mounted there is no local simulation to halt, and the targeted server stop goes out
  // directly, fire-and-forget: a failure must not strand the player on the dead engagement screen.
  const activityID = liveActivity?.id ?? activity?.id;

  const endRun =
    avatarID === undefined || activityID === undefined
      ? undefined
      : () => {
          const client = idleWorkerHandle.client;

          if (client === undefined) {
            void safe(activityClient.stopActivity({ activityID, avatarID }));
          } else {
            runIgnoringRejection(
              sendIdleStopActivity(
                client,
                avatarID,
                activityID,
                idleWorkerHandle.writerAbortSignal,
              ),
            );
          }

          void navigate({ to: '/explore' });
        };

  return (
    <ScreenLayout title="Engagement">
      <EngagementView
        {...(avatarName !== undefined && { avatarName })}
        {...(endRun !== undefined && { onEndRun: endRun })}
      />
      {pendingCount > 0 ? (
        <output
          className={settlingIndicator}
          data-testid="settling-indicator"
          {...(import.meta.env.DEV && { title: `Settling… (${pendingCount})` })}
        >
          <Spinner />
        </output>
      ) : null}
    </ScreenLayout>
  );
}
