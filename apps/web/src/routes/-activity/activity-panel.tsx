import { safe } from '@orpc/client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Spinner } from '@vers/design-system';
import { EngagementView, useRunOutcome } from '@vers/idle-client';
import { css } from '@vers/styled-system/css';
import { useState } from 'react';
import { ScreenLayout } from '../../components/screen-layout';
import { buildCurrentActivityQueryOptions } from '../../lib/activity/build-current-activity-query-options';
import { useActivityRewards } from '../../lib/activity/use-activity-rewards';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { runIgnoringRejection } from '../../lib/idle/run-ignoring-rejection';
import { sendIdleStartActivity } from '../../lib/idle/send-idle-start-activity';
import { sendIdleStopActivity } from '../../lib/idle/send-idle-stop-activity';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { activityClient } from '../../lib/rpc/clients/activity-client';
import { RunOutcomePanel } from './run-outcome-panel';

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
  const rewardsQuery = useActivityRewards(activity?.id);
  const lastRunOutcome = useRunOutcome();
  const [isRetryPending, setIsRetryPending] = useState(false);

  // the store outlives an avatar switch and a sign-in, so an outcome that names another avatar's
  // run is not this page's to show or retry
  const runOutcome =
    lastRunOutcome !== null &&
    (lastRunOutcome.run === undefined || lastRunOutcome.run.avatarID === avatarID)
      ? lastRunOutcome
      : null;

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
  const activityID = activity?.id;

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

  // the ended run names its own node, so a retry never depends on the server row the stop closed
  const endedRun = runOutcome?.run;
  const client = idleWorkerHandle.client;

  const retry =
    endedRun === undefined || client === undefined
      ? undefined
      : () => {
          setIsRetryPending(true);

          void (async () => {
            try {
              await sendIdleStartActivity(client, endedRun, idleWorkerHandle.writerAbortSignal);
            } catch {
              // an aborted or refused start leaves the outcome up, and the button re-arms below
            } finally {
              setIsRetryPending(false);
            }
          })();
        };

  return (
    <ScreenLayout title="Engagement">
      {runOutcome === null ? (
        <EngagementView
          {...(avatarName !== undefined && { avatarName })}
          {...(endRun !== undefined && { onEndRun: endRun })}
        />
      ) : (
        <RunOutcomePanel
          isRetryPending={isRetryPending}
          onBackToMap={() => {
            void navigate({ to: '/explore' });
          }}
          {...(retry !== undefined && { onRetry: retry })}
          outcome={runOutcome}
        />
      )}
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
