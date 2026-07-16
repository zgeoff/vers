import { isDefinedError, safe } from '@orpc/client';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ActivityData } from '@vers/contract-activity';
import { Button, CheckboxField, Spinner } from '@vers/design-system';
import { ActivityFailureAction } from '@vers/idle-core';
import { useSelectedNode } from '@vers/worldmap-client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { SimulationUnsupportedNotice } from '../../components/simulation-unsupported-notice';
import { WorldMapNodeCodexSlot } from '../../components/world-map-node-codex-slot';
import { activeAvatarQueryOptions } from '../../lib/avatar/active-avatar-query-options';
import { IdleWorldMapEncounterActivity } from '../../lib/idle/idle-world-map-encounter-activity';
import { sendIdleInitialize } from '../../lib/idle/send-idle-initialize';
import { sendIdleRequestResync } from '../../lib/idle/send-idle-request-resync';
import { sendIdleSetActivity } from '../../lib/idle/send-idle-set-activity';
import { sendIdleSetFailureAction } from '../../lib/idle/send-idle-set-failure-action';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { useIsSharedWorkerSupported } from '../../lib/platform/use-is-shared-worker-supported';
import { activityClient } from '../../lib/rpc/clients/activity-client';
import type { OrpcQueryUtils } from '../../lib/rpc/orpc';
import { ActivityRewardsPanel } from './activity-rewards-panel';
import { ApproachingCapWarning } from './approaching-cap-warning';

interface StartAttempt {
  readonly activityID?: string;
  readonly scopeID: string;
}

interface ExploreCurrentPanelProps {
  readonly orpc: OrpcQueryUtils;
}

/**
 * The world map node detail view: shows a spinner until the idle worker reports the activity it
 * was sent, then renders the encounter, its auto-retry toggle, and its codex slot. A failed start
 * renders a retry action instead of spinning forever.
 */
export function ExploreCurrentPanel(props: ExploreCurrentPanelProps) {
  const isSharedWorkerSupported = useIsSharedWorkerSupported();
  const idleWorkerHandle = useIdleWorkerHandle();
  const selectedNode = useSelectedNode().node;
  const avatarQuery = useQuery(activeAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;
  const isAutoRetryChecked = idleWorkerHandle.failureAction === ActivityFailureAction.Retry;

  // one start attempt per selected node; the attempt's activity id arrives when its request
  // resolves, so a stale attempt for a deselected node never gates or publishes anything
  const [attempt, setAttempt] = useState<StartAttempt | undefined>(undefined);

  // read by an in-flight start's conflict recovery, which must never stop a newer selection's
  // activity on behalf of a node the player has already left
  const selectedScopeIDRef = useRef<string | undefined>(selectedNode?.id);

  useEffect(() => {
    selectedScopeIDRef.current = selectedNode?.id;
  }, [selectedNode]);

  const isActivityReady =
    attempt?.activityID !== undefined &&
    attempt.scopeID === selectedNode?.id &&
    idleWorkerHandle.activity?.id === attempt.activityID;

  const startMutation = useMutation({
    mutationFn: (input: Readonly<{ avatarID: string; scopeID: string }>) =>
      startActivityForNode(
        input.avatarID,
        input.scopeID,
        () => selectedScopeIDRef.current === input.scopeID,
      ),
    onSuccess: (outcome) => {
      const scopeID = outcome.kind === 'attach' ? outcome.scopeID : outcome.activity.scopeID;

      // a selection change while the request was in flight makes this outcome stale
      if (idleWorkerHandle.worker === undefined || scopeID !== selectedNode?.id) {
        return;
      }

      if (outcome.kind === 'attach') {
        setAttempt({ activityID: outcome.activityID, scopeID });
        sendIdleRequestResync(idleWorkerHandle.worker, outcome.avatarID);

        return;
      }

      setAttempt({ activityID: outcome.activity.id, scopeID });
      sendIdleSetActivity(idleWorkerHandle.worker, outcome.activity);
    },
  });

  const startActivity = startMutation.mutate;
  const resetStart = startMutation.reset;

  useEffect(() => {
    if (idleWorkerHandle.worker === undefined) {
      return;
    }

    if (!idleWorkerHandle.initialized) {
      sendIdleInitialize(idleWorkerHandle.worker);

      return;
    }

    if (avatarID === undefined || selectedNode === null || attempt?.scopeID === selectedNode.id) {
      return;
    }

    setAttempt({ scopeID: selectedNode.id });
    startActivity({ avatarID, scopeID: selectedNode.id });
  }, [
    idleWorkerHandle.worker,
    idleWorkerHandle.initialized,
    avatarID,
    selectedNode,
    attempt,
    startActivity,
  ]);

  if (!isSharedWorkerSupported) {
    return <SimulationUnsupportedNotice />;
  }

  if (startMutation.isError) {
    return (
      <Button
        data-testid="start-activity-retry"
        onClick={() => {
          resetStart();
          setAttempt(undefined);
        }}
      >
        Couldn’t start this activity — retry
      </Button>
    );
  }

  if (!isActivityReady) {
    return <Spinner />;
  }

  return (
    <>
      <CheckboxField
        checkboxProps={{
          checked: isAutoRetryChecked,
          id: 'auto-retry-on-failure',
          onClick: () => {
            if (idleWorkerHandle.worker === undefined) {
              return;
            }

            const nextFailureAction = isAutoRetryChecked
              ? ActivityFailureAction.Abort
              : ActivityFailureAction.Retry;

            sendIdleSetFailureAction(idleWorkerHandle.worker, nextFailureAction);
          },
        }}
        errors={[]}
        labelProps={{ children: 'Auto-retry on failure', htmlFor: 'auto-retry-on-failure' }}
      />
      <ApproachingCapWarning />
      <IdleWorldMapEncounterActivity />
      <ActivityRewardsPanel activityID={idleWorkerHandle.activity?.id} orpc={props.orpc} />
      <Suspense fallback={<p data-testid="world-map-node-codex-loading">Loading codex…</p>}>
        <WorldMapNodeCodexSlot difficulty={selectedNode?.difficulty ?? 1} />
      </Suspense>
    </>
  );
}

/**
 * Starting the same world-map-node scope the caller already has active isn't a failure — the
 * CONFLICT payload's row is exactly the stream to attach to instead. Any other active scope stops
 * that one first: an avatar has one active activity at a time.
 */
type StartOutcome =
  | { readonly activity: ActivityData; readonly kind: 'started' }
  | {
      readonly activityID: string;
      readonly avatarID: string;
      readonly kind: 'attach';
      readonly scopeID: string;
    };

async function startActivityForNode(
  avatarID: string,
  scopeID: string,
  isScopeStillSelected: () => boolean,
): Promise<StartOutcome> {
  const [error, started] = await safe(
    activityClient.startActivity({ avatarID, scopeID, scopeType: 'world_map_node' }),
  );

  if (error === null) {
    return { activity: started, kind: 'started' };
  }

  if (!isDefinedError(error) || error.code !== 'CONFLICT') {
    throw error;
  }

  if (
    error.data.activity.scopeType === 'world_map_node' &&
    error.data.activity.scopeID === scopeID
  ) {
    return {
      activityID: error.data.activity.id,
      avatarID: error.data.activity.avatarID,
      kind: 'attach',
      scopeID: error.data.activity.scopeID,
    };
  }

  // the conflicting row may be the activity a newer selection just started — replace it only
  // while this request's node is still the one on screen
  if (!isScopeStillSelected()) {
    throw error;
  }

  await activityClient.stopActivity({ avatarID });

  const retried = await activityClient.startActivity({
    avatarID,
    scopeID,
    scopeType: 'world_map_node',
  });

  return { activity: retried, kind: 'started' };
}
