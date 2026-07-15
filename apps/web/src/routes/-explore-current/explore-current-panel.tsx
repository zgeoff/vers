import { isDefinedError, safe } from '@orpc/client';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ActivityData } from '@vers/contract-activity';
import { CheckboxField, Spinner } from '@vers/design-system';
import { ActivityFailureAction } from '@vers/idle-core';
import { useSelectedNode } from '@vers/worldmap-client';
import { Suspense, useEffect, useState } from 'react';
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
import { ApproachingCapWarning } from './approaching-cap-warning';

/**
 * Starting the same scope the caller already has active isn't a failure — the CONFLICT payload's
 * row is exactly the stream to attach to instead. A different scope stops that one first: an
 * avatar has one active activity at a time.
 */
type StartOutcome =
  | { readonly activity: ActivityData; readonly kind: 'started' }
  | { readonly activityID: string; readonly avatarID: string; readonly kind: 'attach' };

async function startActivityForNode(avatarID: string, scopeID: string): Promise<StartOutcome> {
  const [error, started] = await safe(
    activityClient.startActivity({ avatarID, scopeID, scopeType: 'world_map_node' }),
  );

  if (error === null) {
    return { activity: started, kind: 'started' };
  }

  if (!isDefinedError(error) || error.code !== 'CONFLICT') {
    throw error;
  }

  if (error.data.activity.scopeID === scopeID) {
    return {
      activityID: error.data.activity.id,
      avatarID: error.data.activity.avatarID,
      kind: 'attach',
    };
  }

  await activityClient.stopActivity({ avatarID });

  const retried = await activityClient.startActivity({
    avatarID,
    scopeID,
    scopeType: 'world_map_node',
  });

  return { activity: retried, kind: 'started' };
}

/**
 * The world map node detail view: shows a spinner until the idle worker reports the activity it
 * was sent, then renders the encounter, its auto-retry toggle, and its codex slot.
 */
export function ExploreCurrentPanel() {
  const isSharedWorkerSupported = useIsSharedWorkerSupported();
  const idleWorkerHandle = useIdleWorkerHandle();
  const selectedNode = useSelectedNode().node;
  const avatarQuery = useQuery(activeAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;
  const isAutoRetryChecked = idleWorkerHandle.failureAction === ActivityFailureAction.Retry;
  const [targetActivityID, setTargetActivityID] = useState<string | undefined>(undefined);

  // the scope a start was last attempted for — one attempt per node selection, not per render
  const [attemptedScopeID, setAttemptedScopeID] = useState<string | undefined>(undefined);

  const isActivityReady =
    targetActivityID !== undefined && idleWorkerHandle.activity?.id === targetActivityID;

  const startMutation = useMutation({
    mutationFn: () => {
      if (avatarID === undefined || selectedNode === null) {
        return Promise.resolve(undefined);
      }

      return startActivityForNode(avatarID, selectedNode.id);
    },
    onSuccess: (outcome) => {
      if (outcome === undefined || idleWorkerHandle.worker === undefined) {
        return;
      }

      if (outcome.kind === 'attach') {
        setTargetActivityID(outcome.activityID);
        sendIdleRequestResync(idleWorkerHandle.worker, outcome.avatarID);

        return;
      }

      setTargetActivityID(outcome.activity.id);
      sendIdleSetActivity(idleWorkerHandle.worker, outcome.activity);
    },
  });

  const startActivity = startMutation.mutate;

  useEffect(() => {
    if (idleWorkerHandle.worker === undefined) {
      return;
    }

    if (!idleWorkerHandle.initialized) {
      sendIdleInitialize(idleWorkerHandle.worker);

      return;
    }

    if (
      isActivityReady ||
      avatarID === undefined ||
      selectedNode === null ||
      attemptedScopeID === selectedNode.id
    ) {
      return;
    }

    setAttemptedScopeID(selectedNode.id);
    startActivity();
  }, [
    idleWorkerHandle.worker,
    idleWorkerHandle.initialized,
    isActivityReady,
    avatarID,
    selectedNode,
    attemptedScopeID,
    startActivity,
  ]);

  if (!isSharedWorkerSupported) {
    return <SimulationUnsupportedNotice />;
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
      <Suspense fallback={<p data-testid="world-map-node-codex-loading">Loading codex…</p>}>
        <WorldMapNodeCodexSlot difficulty={selectedNode?.difficulty ?? 1} />
      </Suspense>
    </>
  );
}
